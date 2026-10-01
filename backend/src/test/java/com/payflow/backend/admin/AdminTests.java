package com.payflow.backend.admin;

import java.sql.Connection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import javax.sql.DataSource;

import com.payflow.backend.PostgresTestConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(PostgresTestConfiguration.class)
class AdminTests {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ObjectMapper json;

    @Autowired
    DataSource database;

    record Account(String id, String wallet, String email, String token, String cookie) {
    }

    private Account admin, customer, merchant;

    private String paymentRequest;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE users CASCADE");
        admin = account("admin", "01");
        customer = account("customer", "02");
        merchant = account("merchant", "03");
        jdbc.update("UPDATE users SET role = 'ADMIN' WHERE id = ?::uuid", admin.id());
        postRequest(merchant, "/merchants",
                "{\"businessName\":\"Shop\",\"contactEmail\":\"shop@example.com\",\"contactNumber\":\"9812345678\"}",
                "enroll")
            .andExpect(status().isOk());
        paymentRequest = data(postRequest(merchant, "/merchants/payment-requests", "{\"amount\":100}", "create"))
            .path("paymentRequestId")
            .asText();
        postRequest(customer, "/wallet/deposit", "{\"amount\":1000}", "fund").andExpect(status().isOk());
    }

    @Test
    void listsDetailsAndPaginationAreAdministratorOnlyAndExcludeSecrets() throws Exception {
        for (Account caller : List.of(customer, merchant)) {
            for (String path : List.of("/admin/accounts", "/admin/wallets", "/admin/accounts/" + customer.id(),
                    "/admin/wallets/" + customer.wallet()))
                read(caller, path).andExpect(status().isForbidden());
            set(caller, "accounts", customer.id(), "SUSPENDED").andExpect(status().isForbidden());
            set(caller, "wallets", customer.wallet(), "FROZEN").andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/v1/admin/accounts")).andExpect(status().isUnauthorized());
        var first = data(read(admin, "/admin/accounts?size=2").andExpect(status().isOk()));
        var second = data(read(admin, "/admin/accounts?page=1&size=2"));
        assertThat(first.path("totalElements").asInt()).isEqualTo(3);
        assertThat(first.path("content").size()).isEqualTo(2);
        assertThat(second.path("content").size()).isEqualTo(1);
        assertThat(first.path("content").get(0).path("accountId"))
            .isNotEqualTo(second.path("content").get(0).path("accountId"));
        read(admin, "/admin/accounts?page=8").andExpect(jsonPath("$.data.content").isEmpty());
        read(admin, "/admin/wallets?size=1").andExpect(jsonPath("$.data.totalElements").value(3));
        for (String path : List.of("/admin/accounts/" + customer.id(), "/admin/wallets/" + customer.wallet())) {
            String body = read(admin, path).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertThat(body).doesNotContain("password", "token", "session")
                .contains(customer.email(), customer.wallet());
        }
        for (String params : List.of("page=-1", "size=0", "size=101", "page=2147483647&size=100"))
            read(admin, "/admin/accounts?" + params).andExpect(status().isBadRequest());
        read(admin, "/admin/accounts/" + UUID.randomUUID()).andExpect(status().isNotFound());
        read(admin, "/admin/wallets/" + UUID.randomUUID()).andExpect(status().isNotFound());
    }

    @Test
    void suspensionRevokesAllSessionsAndReactivationRequiresFreshLogin() throws Exception {
        Account secondSession = login(customer.id(), customer.wallet(), customer.email());
        set(admin, "accounts", customer.id(), "SUSPENDED").andExpect(status().isOk());
        set(admin, "accounts", customer.id(), "SUSPENDED").andExpect(status().isOk());
        for (Account session : List.of(customer, secondSession)) {
            for (String path : List.of("/auth/me", "/wallet", "/transactions", "/admin/accounts"))
                read(session, path).andExpect(status().isUnauthorized());
            refresh(session).andExpect(status().isUnauthorized());
            postRequest(session, "/wallet/deposit", "{\"amount\":1}", "blocked").andExpect(status().isUnauthorized());
        }
        loginRequest(customer.email()).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM login_sessions WHERE user_id = ?::uuid AND revoked_at IS NULL", Long.class,
                customer.id()))
            .isZero();
        set(admin, "accounts", customer.id(), "ACTIVE").andExpect(status().isOk());
        read(customer, "/wallet").andExpect(status().isUnauthorized());
        refresh(secondSession).andExpect(status().isUnauthorized());
        var fresh = login(customer.id(), customer.wallet(), customer.email());
        read(fresh, "/wallet").andExpect(status().isOk());
        assertThat(auditCount()).isEqualTo(2);
        read(admin, "/admin/accounts/" + customer.id() + "?size=1")
            .andExpect(jsonPath("$.data.audits.totalElements").value(2))
            .andExpect(jsonPath("$.data.audits.content[0].actorId").value(admin.id()))
            .andExpect(jsonPath("$.data.audits.content[0].targetId").value(customer.id()))
            .andExpect(jsonPath("$.data.audits.content[0].previousState").value("SUSPENDED"))
            .andExpect(jsonPath("$.data.audits.content[0].newState").value("ACTIVE"))
            .andExpect(jsonPath("$.data.audits.content[0].reason").value("Review complete"))
            .andExpect(jsonPath("$.data.audits.content[0].createdAt").isNotEmpty());
    }

    @Test
    void statusNoOpsPreserveTimestampsVersionsAndIndependentAccountWalletStates() throws Exception {
        var before = walletState(customer.wallet());
        set(admin, "wallets", customer.wallet(), "ACTIVE").andExpect(status().isOk());
        set(admin, "accounts", customer.id(), "ACTIVE").andExpect(status().isOk());
        assertThat(walletState(customer.wallet())).isEqualTo(before);
        assertThat(auditCount()).isZero();
        set(admin, "wallets", customer.wallet(), "FROZEN").andExpect(status().isOk());
        var frozen = walletState(customer.wallet());
        set(admin, "wallets", customer.wallet(), "FROZEN").andExpect(status().isOk());
        assertThat(walletState(customer.wallet())).isEqualTo(frozen);
        read(customer, "/wallet").andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("FROZEN"));
        read(customer, "/transactions").andExpect(status().isOk());
        set(admin, "accounts", customer.id(), "SUSPENDED").andExpect(status().isOk());
        set(admin, "wallets", customer.wallet(), "ACTIVE").andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT status FROM users WHERE id = ?::uuid", String.class, customer.id()))
            .isEqualTo("SUSPENDED");
        set(admin, "wallets", customer.wallet(), "FROZEN").andExpect(status().isOk());
        set(admin, "accounts", customer.id(), "ACTIVE").andExpect(status().isOk());
        assertThat(
                jdbc.queryForObject("SELECT status FROM wallets WHERE id = ?::uuid", String.class, customer.wallet()))
            .isEqualTo("FROZEN");
        assertThat(auditCount()).isEqualTo(5);
    }

    @Test
    void invalidRequestsAndSelfSuspensionCannotChangeState() throws Exception {
        set(admin, "accounts", admin.id(), "SUSPENDED").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("SELF_SUSPENSION"));
        for (String body : List.of("{}", "{\"status\":\"FROZEN\",\"reason\":\"x\"}",
                "{\"status\":\"ACTIVE\",\"reason\":\" \"}",
                "{\"status\":\"ACTIVE\",\"reason\":\"x\",\"role\":\"ADMIN\"}", "{\"status\":true,\"reason\":\"x\"}"))
            putRequest(admin, "accounts", customer.id(), body).andExpect(status().isBadRequest());
        putRequest(admin, "wallets", customer.wallet(),
                json.writeValueAsString(Map.of("status", "FROZEN", "reason", "x".repeat(501))))
            .andExpect(status().isBadRequest());
        set(admin, "wallets", customer.wallet(), "SUSPENDED").andExpect(status().isBadRequest());
        assertThat(auditCount()).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'",
                Long.class))
            .isEqualTo(1);
    }

    @Test
    void publicRegistrationAndEnrollmentCannotSelectAdminOrStatus() throws Exception {
        mvc.perform(auth("register").contentType(MediaType.APPLICATION_JSON)
            .content(
                    "{\"fullName\":\"Eve\",\"email\":\"eve@example.com\",\"phone\":\"9812345699\",\"password\":\"Demo-password-123\",\"role\":\"ADMIN\",\"status\":\"SUSPENDED\"}"))
            .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE email = 'eve@example.com'", Long.class))
            .isZero();
        account("eve", "99");
        assertThat(jdbc.queryForMap("SELECT role, status FROM users WHERE email = 'eve@example.com'"))
            .containsEntry("role", "USER")
            .containsEntry("status", "ACTIVE");
        postRequest(customer, "/merchants",
                "{\"businessName\":\"Shop 2\",\"contactEmail\":\"shop2@example.com\",\"contactNumber\":\"9812345678\",\"role\":\"ADMIN\",\"status\":\"SUSPENDED\"}",
                "enroll")
            .andExpect(status().isOk());
        read(customer, "/auth/me").andExpect(jsonPath("$.data.role").value("MERCHANT"))
            .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void concurrentOpposingAdminSuspensionsLeaveOneActiveAdministrator() throws Exception {
        Account other = account("other-admin", "04");
        jdbc.update("UPDATE users SET role = 'ADMIN' WHERE id = ?::uuid", other.id());
        var results = race(() -> code(set(admin, "accounts", other.id(), "SUSPENDED")),
                () -> code(set(other, "accounts", admin.id(), "SUSPENDED")));
        assertThat(results).contains(200);
        assertThat(results.stream().filter(c -> c == 200).count()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'",
                Long.class))
            .isEqualTo(1);
        assertThat(auditCount()).isEqualTo(1);
    }

    @Test
    void concurrentSameStateChangesCreateExactlyOneAudit() throws Exception {
        assertThat(race(() -> code(set(admin, "wallets", customer.wallet(), "FROZEN")),
                () -> code(set(admin, "wallets", customer.wallet(), "FROZEN"))))
            .containsExactly(200, 200);
        assertThat(auditCount()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT version FROM wallets WHERE id = ?::uuid", Long.class, customer.wallet()))
            .isEqualTo(2);
    }

    @Test
    void auditInsertFailureRollsBackAccountSessionAndWalletChanges() throws Exception {
        jdbc.execute(
                "CREATE FUNCTION reject_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected failure'; END; $$");
        jdbc.execute(
                "CREATE TRIGGER reject_admin_audit BEFORE INSERT ON status_audits FOR EACH ROW EXECUTE FUNCTION reject_admin_audit()");
        var before = walletState(customer.wallet());
        var accountBefore = jdbc.queryForMap("SELECT status, updated_at FROM users WHERE id = ?::uuid", customer.id());
        try {
            set(admin, "accounts", customer.id(), "SUSPENDED").andExpect(status().isInternalServerError());
            set(admin, "wallets", customer.wallet(), "FROZEN").andExpect(status().isInternalServerError());
            assertThat(walletState(customer.wallet())).isEqualTo(before);
            assertThat(jdbc.queryForMap("SELECT status, updated_at FROM users WHERE id = ?::uuid", customer.id()))
                .isEqualTo(accountBefore);
            read(customer, "/wallet").andExpect(status().isOk());
            refresh(customer).andExpect(status().isOk());
            assertThat(auditCount()).isZero();
        }
        finally {
            jdbc.execute("DROP TRIGGER reject_admin_audit ON status_audits");
            jdbc.execute("DROP FUNCTION reject_admin_audit()");
        }
        set(admin, "accounts", customer.id(), "SUSPENDED").andExpect(status().isOk());
        assertThat(auditCount()).isEqualTo(1);
    }

    @Test
    void auditsCannotBeEditedDeletedOrInventInvalidTargets() throws Exception {
        set(admin, "wallets", customer.wallet(), "FROZEN").andExpect(status().isOk());
        assertThatThrownBy(() -> jdbc.update("UPDATE status_audits SET reason = 'tampered'"))
            .isInstanceOf(Exception.class);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM status_audits")).isInstanceOf(Exception.class);
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO status_audits SELECT gen_random_uuid(), actor_id, resource_type, gen_random_uuid(), previous_state, new_state, reason, created_at FROM status_audits"))
            .isInstanceOf(Exception.class);
        assertThat(auditCount()).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = { "DEPOSIT", "TRANSFER", "PAYMENT", "REFUND" })
    void frozenParticipantsRejectNewOperationsButCommittedKeysAndOutcomeRemainRecoverable(String operation)
            throws Exception {
        String original = prepare(operation);
        Account caller = operation.equals("REFUND") ? merchant : customer;
        JsonNode receipt = data(financial(operation, original, "committed").andExpect(status().isOk()));
        Account target = operation.equals("DEPOSIT") ? customer : merchant;
        set(admin, "wallets", target.wallet(), "FROZEN").andExpect(status().isOk());
        var before = financialState();
        assertThat(data(financial(operation, original, "committed").andExpect(status().isOk()))).isEqualTo(receipt);
        String fresh = operation.equals("PAYMENT") ? createRequest()
                : operation.equals("REFUND") ? prepareSecondRefund() : original;
        if (operation.equals("REFUND"))
            set(admin, "wallets", target.wallet(), "FROZEN").andExpect(status().isOk());
        before = financialState();
        financial(operation, fresh, "blocked").andExpect(status().isConflict());
        read(caller, "/transactions/outcome?operation=" + operationType(operation) + "&key=committed")
            .andExpect(jsonPath("$.data.state").value("FOUND"));
        assertThat(financialState()).isEqualTo(before);
        set(admin, "wallets", target.wallet(), "ACTIVE").andExpect(status().isOk());
        financial(operation, fresh, "blocked").andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = { "TRANSFER", "PAYMENT", "REFUND" })
    void unavailableCounterpartyRejectsWithoutPartialChangesAndAllowsCommittedReplay(String operation)
            throws Exception {
        String original = prepare(operation);
        var receipt = data(financial(operation, original, "committed").andExpect(status().isOk()));
        String fresh = operation.equals("PAYMENT") ? createRequest()
                : operation.equals("REFUND") ? prepareSecondRefund() : original;
        Account target = operation.equals("REFUND") ? customer : merchant;
        set(admin, "accounts", target.id(), "SUSPENDED").andExpect(status().isOk());
        var before = financialState();
        financial(operation, fresh, "blocked").andExpect(status().isConflict());
        assertThat(data(financial(operation, original, "committed").andExpect(status().isOk()))).isEqualTo(receipt);
        assertThat(financialState()).isEqualTo(before);
        set(admin, "accounts", target.id(), "ACTIVE").andExpect(status().isOk());
        financial(operation, fresh, "blocked").andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = { "DEPOSIT", "TRANSFER", "PAYMENT", "REFUND" })
    void financialCommitHoldingWalletWinsBeforeFreeze(String operation) throws Exception {
        String original = prepare(operation);
        Account target = operation.equals("DEPOSIT") ? customer : merchant;
        try (Gate gate = gate("transactions")) {
            ExecutorService executor = Executors.newFixedThreadPool(2);
            try {
                var money = executor.submit(() -> code(financial(operation, original, "race")));
                gate.awaitWaiter(); // receipt insertion has flushed balances and holds
                                    // wallet locks
                var freeze = executor.submit(() -> code(set(admin, "wallets", target.wallet(), "FROZEN")));
                gate.release();
                assertThat(money.get(15, TimeUnit.SECONDS)).isEqualTo(200);
                assertThat(freeze.get(15, TimeUnit.SECONDS)).isEqualTo(200);
                assertThat(
                        data(financial(operation, original, "race").andExpect(status().isOk())).path("type").asText())
                    .isEqualTo(operationType(operation));
                assertThat(auditCount()).isEqualTo(1);
            }
            finally {
                executor.shutdownNow();
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = { "DEPOSIT", "TRANSFER", "PAYMENT", "REFUND" })
    void freezeHoldingWalletWinsBeforeFinancialOperation(String operation) throws Exception {
        String original = prepare(operation);
        Account target = operation.equals("DEPOSIT") ? customer : merchant;
        var before = allMoney();
        try (Gate gate = gate("status_audits")) {
            ExecutorService executor = Executors.newFixedThreadPool(2);
            try {
                var freeze = executor.submit(() -> code(set(admin, "wallets", target.wallet(), "FROZEN")));
                gate.awaitWaiter(); // target already flushed, audit/commit paused, wallet
                                    // lock held
                var money = executor.submit(() -> code(financial(operation, original, "race")));
                gate.release();
                assertThat(freeze.get(15, TimeUnit.SECONDS)).isEqualTo(200);
                assertThat(money.get(15, TimeUnit.SECONDS)).isEqualTo(409);
                assertThat(allMoney()).isEqualTo(before);
                assertThat(auditCount()).isEqualTo(1);
            }
            finally {
                executor.shutdownNow();
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = { "TRANSFER", "PAYMENT", "REFUND" })
    void suspensionHoldingWalletWinsBeforeCounterpartyOperation(String operation) throws Exception {
        String original = prepare(operation);
        Account target = operation.equals("REFUND") ? customer : merchant;
        var before = allMoney();
        try (Gate gate = gate("status_audits")) {
            ExecutorService executor = Executors.newFixedThreadPool(2);
            try {
                var suspend = executor.submit(() -> code(set(admin, "accounts", target.id(), "SUSPENDED")));
                gate.awaitWaiter();
                var money = executor.submit(() -> code(financial(operation, original, "race")));
                gate.release();
                assertThat(suspend.get(15, TimeUnit.SECONDS)).isEqualTo(200);
                assertThat(money.get(15, TimeUnit.SECONDS)).isEqualTo(409);
                assertThat(allMoney()).isEqualTo(before);
            }
            finally {
                executor.shutdownNow();
            }
        }
    }

    @Test
    void concurrentLoginAndRefreshCannotSurviveSuspensionOrReviveOnReactivation() throws Exception {
        try (Gate gate = gate("status_audits")) {
            ExecutorService executor = Executors.newFixedThreadPool(3);
            try {
                var suspend = executor.submit(() -> code(set(admin, "accounts", customer.id(), "SUSPENDED")));
                gate.awaitWaiter();
                var login = executor.submit(() -> code(loginRequest(customer.email())));
                var refresh = executor.submit(() -> code(refresh(customer)));
                gate.release();
                assertThat(suspend.get(15, TimeUnit.SECONDS)).isEqualTo(200);
                assertThat(login.get(15, TimeUnit.SECONDS)).isEqualTo(401);
                assertThat(refresh.get(15, TimeUnit.SECONDS)).isEqualTo(401);
                set(admin, "accounts", customer.id(), "ACTIVE").andExpect(status().isOk());
                assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM login_sessions WHERE user_id = ?::uuid AND revoked_at IS NULL",
                        Long.class, customer.id()))
                    .isZero();
            }
            finally {
                executor.shutdownNow();
            }
        }
    }

    @Test
    void suspensionBlocksAnAlreadyAuthenticatedDepositWaitingOnItsWallet() throws Exception {
        var before = allMoney();
        try (Gate gate = gate("status_audits")) {
            ExecutorService executor = Executors.newFixedThreadPool(2);
            try {
                var suspend = executor.submit(() -> code(set(admin, "accounts", customer.id(), "SUSPENDED")));
                gate.awaitWaiter();
                var deposit = executor.submit(() -> code(financial("DEPOSIT", paymentRequest, "waiting-deposit")));
                gate.awaitRowWaiter();
                gate.release();
                assertThat(suspend.get(15, TimeUnit.SECONDS)).isEqualTo(200);
                assertThat(deposit.get(15, TimeUnit.SECONDS)).isEqualTo(409);
                assertThat(allMoney()).isEqualTo(before);
                assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM transactions WHERE idempotency_key = 'waiting-deposit'", Long.class))
                    .isZero();
                read(customer, "/wallet").andExpect(status().isUnauthorized());
            }
            finally {
                executor.shutdownNow();
            }
        }
    }

    private Gate gate(String table) throws Exception {
        return new Gate(table);
    }

    private class Gate implements AutoCloseable {

        final Connection connection;

        final String table;

        boolean released;

        Gate(String table) throws Exception {
            this.table = table;
            connection = database.getConnection();
            connection.createStatement().execute("SELECT pg_advisory_lock(72419002)");
            jdbc.execute(
                    "CREATE FUNCTION admin_test_gate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(72419002); RETURN NEW; END; $$");
            jdbc.execute("CREATE TRIGGER admin_test_gate BEFORE INSERT ON " + table
                    + " FOR EACH ROW EXECUTE FUNCTION admin_test_gate()");
        }

        void awaitWaiter() throws Exception {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            while (System.nanoTime() < deadline) {
                if (jdbc.queryForObject(
                        "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND objid = 72419002 AND NOT granted",
                        Integer.class) > 0)
                    return;
                Thread.sleep(10);
            }
            throw new AssertionError("Operation did not reach the database gate");
        }

        void awaitRowWaiter() throws Exception {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            while (System.nanoTime() < deadline) {
                if (jdbc.queryForObject(
                        "SELECT count(*) FROM pg_locks WHERE locktype = 'transactionid' AND NOT granted",
                        Integer.class) > 0)
                    return;
                Thread.sleep(10);
            }
            throw new AssertionError("Operation did not wait for a wallet lock");
        }

        void release() throws Exception {
            if (!released) {
                connection.createStatement().execute("SELECT pg_advisory_unlock(72419002)");
                released = true;
            }
        }

        public void close() throws Exception {
            release();
            connection.close();
            jdbc.execute("DROP TRIGGER admin_test_gate ON " + table);
            jdbc.execute("DROP FUNCTION admin_test_gate()");
        }

    }

    private String prepare(String operation) throws Exception {
        if (!operation.equals("REFUND"))
            return paymentRequest;
        return data(financial("PAYMENT", paymentRequest, "original").andExpect(status().isOk())).path("transactionId")
            .asText();
    }

    private String prepareSecondRefund() throws Exception {
        set(admin, "wallets", merchant.wallet(), "ACTIVE").andExpect(status().isOk());
        String id = data(financial("PAYMENT", createRequest(), "second-payment").andExpect(status().isOk()))
            .path("transactionId")
            .asText();
        // Freeze only if this test had frozen the wallet before the helper.
        return id;
    }

    private String createRequest() throws Exception {
        return data(postRequest(merchant, "/merchants/payment-requests", "{\"amount\":100}", "create")
            .andExpect(status().isOk())).path("paymentRequestId").asText();
    }

    private String operationType(String operation) {
        return operation.equals("PAYMENT") ? "MERCHANT_PAYMENT" : operation;
    }

    private ResultActions financial(String operation, String id, String key) throws Exception {
        return switch (operation) {
            case "DEPOSIT" -> postRequest(customer, "/wallet/deposit", "{\"amount\":10}", key);
            case "TRANSFER" -> postRequest(customer, "/transfers",
                    "{\"receiverWalletId\":\"" + merchant.wallet() + "\",\"amount\":10}", key);
            case "PAYMENT" -> postRequest(customer, "/payments/" + id + "/pay", "{}", key);
            case "REFUND" -> postRequest(merchant, "/merchants/payments/" + id + "/refund", "", key);
            default -> throw new IllegalArgumentException(operation);
        };
    }

    private Map<String, Object> walletState(String id) {
        return jdbc.queryForMap("SELECT balance, status, version, updated_at FROM wallets WHERE id = ?::uuid", id);
    }

    private List<Map<String, Object>> allMoney() {
        return jdbc.queryForList("SELECT id, balance FROM wallets ORDER BY id");
    }

    private Map<String, Object> financialState() {
        return Map.of("wallets", jdbc.queryForList("SELECT id, balance, version, updated_at FROM wallets ORDER BY id"),
                "receipts", jdbc.queryForList("SELECT id, idempotency_key FROM transactions ORDER BY id"), "requests",
                jdbc.queryForList("SELECT id, status FROM payment_requests ORDER BY id"));
    }

    private long auditCount() {
        return jdbc.queryForObject("SELECT count(*) FROM status_audits", Long.class);
    }

    private ResultActions set(Account actor, String resource, String id, String state) throws Exception {
        return putRequest(actor, resource, id,
                json.writeValueAsString(Map.of("status", state, "reason", "  Review complete  ")));
    }

    private ResultActions putRequest(Account actor, String resource, String id, String body) throws Exception {
        return mvc.perform(put("/api/v1/admin/" + resource + "/" + id + "/status")
            .header("Authorization", "Bearer " + actor.token())
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
    }

    private ResultActions read(Account actor, String path) throws Exception {
        return mvc.perform(get("/api/v1" + path).header("Authorization", "Bearer " + actor.token()));
    }

    private ResultActions postRequest(Account actor, String path, String body, String key) throws Exception {
        return mvc.perform(post("/api/v1" + path).header("Authorization", "Bearer " + actor.token())
            .header("Idempotency-Key", key)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
    }

    private MockHttpServletRequestBuilder auth(String path) {
        return post("/api/v1/auth/" + path).header("Origin", "https://localhost").header("X-PayFlow-CSRF", "1");
    }

    private ResultActions loginRequest(String email) throws Exception {
        return mvc.perform(auth("login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", email, "password", "Demo-password-123"))));
    }

    private ResultActions refresh(Account account) throws Exception {
        return mvc.perform(auth("refresh").header("Cookie", account.cookie())
            .cookie(new Cookie("payflow_refresh", account.cookie().split("=", 2)[1])));
    }

    private Account account(String name, String phone) throws Exception {
        String email = name + "@example.com";
        mvc.perform(auth("register").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("fullName", name, "email", email, "phone", "+97798123456" + phone,
                    "password", "Demo-password-123"))))
            .andExpect(status().isCreated());
        String id = jdbc.queryForObject("SELECT id::text FROM users WHERE email = ?", String.class, email);
        String wallet = jdbc.queryForObject("SELECT id::text FROM wallets WHERE user_id = ?::uuid", String.class, id);
        return login(id, wallet, email);
    }

    private Account login(String id, String wallet, String email) throws Exception {
        MvcResult result = loginRequest(email).andExpect(status().isOk()).andReturn();
        String token = json.readTree(result.getResponse().getContentAsString())
            .path("data")
            .path("accessToken")
            .asText();
        return new Account(id, wallet, email, token, result.getResponse().getHeader("Set-Cookie").split(";", 2)[0]);
    }

    private JsonNode data(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString()).path("data");
    }

    private int code(ResultActions result) throws Exception {
        return result.andReturn().getResponse().getStatus();
    }

    private <T> List<T> race(Callable<T> first, Callable<T> second) throws Exception {
        try (var executor = Executors.newFixedThreadPool(2)) {
            var barrier = new CyclicBarrier(2);
            Future<T> a = executor.submit(() -> {
                barrier.await(10, TimeUnit.SECONDS);
                return first.call();
            });
            Future<T> b = executor.submit(() -> {
                barrier.await(10, TimeUnit.SECONDS);
                return second.call();
            });
            return List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
        }
    }

}

package com.payflow.backend.payment;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import com.payflow.backend.PostgresTestConfiguration;
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
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(PostgresTestConfiguration.class)
class MerchantPaymentTests {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ObjectMapper json;

    private String customer, merchant, other, customerWallet, merchantWallet, merchantId, requestId;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE TABLE users, wallets, transactions CASCADE");
        customer = account("customer@example.com", "+9779812345678");
        merchant = account("merchant@example.com", "+9779812345679");
        other = account("other@example.com", "+9779812345680");
        customerWallet = wallet(customer);
        merchantWallet = wallet(merchant);
        merchantId = data(enroll(merchant).andExpect(status().isOk())).path("merchantId").asText();
        requestId = create("250.25");
        fund(customer, "1000");
    }

    @Test
    void acceptanceCustomerPaysMerchantAndRetriesReturnOneReceipt() throws Exception {
        read(customer, "/payments/" + requestId).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.businessName").value("Demo Shop"))
            .andExpect(jsonPath("$.data.status").value("PENDING"));
        var receipt = data(pay(customer, requestId, "checkout").andExpect(status().isOk())
            .andExpect(jsonPath("$.data.type").value("MERCHANT_PAYMENT"))
            .andExpect(jsonPath("$.data.status").value("SUCCESS"))
            .andExpect(jsonPath("$.data.paymentRequestId").value(requestId)));
        for (int i = 0; i < 3; i++)
            assertThat(data(pay(customer, requestId, "checkout").andExpect(status().isOk()))).isEqualTo(receipt);
        state("749.75", "250.25", 1);
        assertThat(jdbc.queryForObject("SELECT version FROM wallets WHERE id = ?::uuid", Long.class, customerWallet))
            .isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT version FROM wallets WHERE id = ?::uuid", Long.class, merchantWallet))
            .isEqualTo(1);
        for (String bearer : new String[] { customer, merchant }) {
            read(bearer, "/transactions/" + receipt.path("transactionId").asText()).andExpect(status().isOk());
            read(bearer, "/payments/" + requestId).andExpect(jsonPath("$.data.status").value("PAID"))
                .andExpect(jsonPath("$.data.transactionId").value(receipt.path("transactionId").asText()));
        }
        read(merchant, "/merchants/payments").andExpect(jsonPath("$.data.totalElements").value(1));
        read(merchant, "/merchants/payment-requests").andExpect(jsonPath("$.data.content[0].status").value("PAID"));
        read(customer, "/transactions/outcome?operation=MERCHANT_PAYMENT&key=checkout")
            .andExpect(jsonPath("$.data.state").value("FOUND"));
        read(other, "/transactions/outcome?operation=MERCHANT_PAYMENT&key=checkout")
            .andExpect(jsonPath("$.data.state").value("UNKNOWN"));
        read(other, "/transactions/" + receipt.path("transactionId").asText()).andExpect(status().isNotFound());
        read(other, "/payments/" + requestId).andExpect(jsonPath("$.data.transactionId").isEmpty());
        pay(customer, requestId, "new-key").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PAYMENT_REQUEST_PAID"));
        state("749.75", "250.25", 1);
    }

    @Test
    void enrollmentIsOwnedSerializedAndCannotChoosePrivilegesOrWallet() throws Exception {
        assertThat(data(enroll(merchant).andExpect(status().isOk())).path("merchantId").asText()).isEqualTo(merchantId);
        read(merchant, "/auth/me").andExpect(jsonPath("$.data.role").value("MERCHANT"));
        read(merchant, "/merchants/me").andExpect(jsonPath("$.data.walletId").value(merchantWallet));
        read(customer, "/merchants/me").andExpect(status().isNotFound());
        var profiles = race(() -> data(enroll(other).andExpect(status().isOk())).path("merchantId").asText(),
                () -> data(enroll(other).andExpect(status().isOk())).path("merchantId").asText());
        assertThat(profiles.get(0)).isEqualTo(profiles.get(1)).isNotEqualTo(merchantId);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM merchants", Long.class)).isEqualTo(2);
        write(customer, "/merchants",
                "{\"businessName\":\"Other Shop\",\"contactEmail\":\"shop@example.com\",\"contactNumber\":\"9812345678\",\"role\":\"ADMIN\",\"userId\":\""
                        + merchantId + "\",\"walletId\":\"" + merchantWallet + "\"}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.walletId").value(customerWallet));
        read(customer, "/auth/me").andExpect(jsonPath("$.data.role").value("MERCHANT"));
        enroll(customer).andExpect(status().isConflict());
    }

    @Test
    void concurrentSameKeyAttemptsReturnIdenticalReceipt() throws Exception {
        var results = race(() -> data(pay(customer, requestId, "same").andExpect(status().isOk())),
                () -> data(pay(customer, requestId, "same").andExpect(status().isOk())));
        assertThat(results.get(0)).isEqualTo(results.get(1));
        state("749.75", "250.25", 1);
        assertThat(jdbc.queryForObject("SELECT version FROM wallets WHERE id = ?::uuid", Long.class, customerWallet))
            .isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT version FROM wallets WHERE id = ?::uuid", Long.class, merchantWallet))
            .isEqualTo(1);
    }

    @Test
    void paymentCompetingWithTransferUsesTheSameWalletLocks() throws Exception {
        String payment = create("800");
        String otherWallet = wallet(other);
        assertThat(race(() -> code(pay(customer, payment, "competing")),
                () -> code(write(customer, "/transfers",
                        "{\"receiverWalletId\":\"" + otherWallet + "\",\"amount\":700}", "competing"))))
            .containsExactlyInAnyOrder(200, 409);
        assertThat(
                jdbc.queryForObject("SELECT balance FROM wallets WHERE id = ?::uuid", BigDecimal.class, customerWallet))
            .isIn(new BigDecimal("200.00"), new BigDecimal("300.00"));
        assertThat(jdbc.queryForObject("SELECT sum(balance) FROM wallets", BigDecimal.class))
            .isEqualByComparingTo("1000");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM transactions WHERE type IN ('TRANSFER','MERCHANT_PAYMENT')", Long.class))
            .isEqualTo(1);
    }

    @Test
    void oppositeDirectionMerchantPaymentsFinishWithoutDeadlock() throws Exception {
        enroll(customer).andExpect(status().isOk());
        fund(merchant, "1000");
        String opposite = data(
                write(customer, "/merchants/payment-requests", "{\"amount\":100}").andExpect(status().isOk()))
            .path("paymentRequestId")
            .asText();
        assertThat(
                race(() -> code(pay(customer, requestId, "opposite")), () -> code(pay(merchant, opposite, "opposite"))))
            .containsOnly(200);
        state("849.75", "1150.25", 2);
        // The merchant dashboard lists incoming payments, excluding its outgoing one.
        read(merchant, "/merchants/payments").andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].paymentRequestId").value(requestId));
        read(customer, "/merchants/payment-requests").andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].paymentRequestId").value(opposite));
    }

    @Test
    void concurrentDifferentKeysCannotPayOneRequestTwice() throws Exception {
        assertThat(race(() -> code(pay(customer, requestId, "one")), () -> code(pay(customer, requestId, "two"))))
            .containsExactlyInAnyOrder(200, 409);
        state("749.75", "250.25", 1);
    }

    @Test
    void concurrentDifferentCustomersHaveOneWinner() throws Exception {
        fund(other, "1000");
        assertThat(race(() -> code(pay(customer, requestId, "same")), () -> code(pay(other, requestId, "same"))))
            .containsExactlyInAnyOrder(200, 409);
        assertThat(
                jdbc.queryForObject("SELECT balance FROM wallets WHERE id = ?::uuid", BigDecimal.class, merchantWallet))
            .isEqualByComparingTo("250.25");
        assertThat(jdbc.queryForObject("SELECT sum(balance) FROM wallets", BigDecimal.class))
            .isEqualByComparingTo("2000");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM transactions WHERE type = 'MERCHANT_PAYMENT'", Long.class))
            .isEqualTo(1);
        assertThat(jdbc.queryForList("SELECT balance FROM wallets WHERE id <> ?::uuid ORDER BY balance",
                BigDecimal.class, merchantWallet))
            .containsExactly(new BigDecimal("749.75"), new BigDecimal("1000.00"));
    }

    @Test
    void concurrentRequestsCannotOverspend() throws Exception {
        String a = create("800"), b = create("700");
        assertThat(race(() -> code(pay(customer, a, "a")), () -> code(pay(customer, b, "b"))))
            .containsExactlyInAnyOrder(200, 409);
        assertThat(jdbc.queryForObject("SELECT sum(balance) FROM wallets", BigDecimal.class))
            .isEqualByComparingTo("1000");
        assertThat(jdbc.queryForObject("SELECT min(balance) FROM wallets", BigDecimal.class)).isNotNegative();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM payment_requests WHERE status = 'PAID'", Long.class))
            .isEqualTo(1);
    }

    @Test
    void keysArePayerAndOperationScopedAndDifferentRequestsConflict() throws Exception {
        pay(customer, requestId, "fund-1000").andExpect(status().isOk()); // deposit uses
                                                                          // this
        // same key
        pay(customer, create("1"), "fund-1000").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
        fund(other, "1000");
        pay(other, create("1"), "fund").andExpect(status().isOk());
        state("749.75", "251.25", 2);
    }

    @Test
    void insufficientFundsFrozenWalletsAndInactiveMerchantNeverPartiallySettle() throws Exception {
        String expensive = create("1000.01");
        pay(customer, expensive, "retry").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("INSUFFICIENT_BALANCE"));
        for (String id : new String[] { customerWallet, merchantWallet }) {
            jdbc.update("UPDATE wallets SET status = 'FROZEN' WHERE id = ?::uuid", id);
            pay(customer, requestId, "frozen").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WALLET_FROZEN"));
            jdbc.update("UPDATE wallets SET status = 'ACTIVE' WHERE id = ?::uuid", id);
        }
        jdbc.update("UPDATE merchants SET status = 'SUSPENDED'");
        pay(customer, requestId, "suspended").andExpect(status().isConflict());
        jdbc.update("UPDATE merchants SET status = 'ACTIVE'");
        jdbc.update("UPDATE users SET status = 'SUSPENDED' WHERE email = 'merchant@example.com'");
        pay(customer, requestId, "suspended").andExpect(status().isConflict());
        jdbc.update("UPDATE users SET status = 'ACTIVE' WHERE email = 'merchant@example.com'");
        state("1000", "0", 0);
        fund(customer, "1");
        pay(customer, expensive, "retry").andExpect(status().isOk());
        state("0.99", "1000.01", 1);
    }

    @Test
    void receiverLimitAndSelfPaymentAreRejected() throws Exception {
        pay(merchant, requestId, "self").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("SELF_PAYMENT"));
        for (int i = 0; i < 10; i++)
            write(merchant, "/wallet/deposit", "{\"amount\":100000}", "deposit-" + i).andExpect(status().isOk());
        pay(customer, requestId, "overflow").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("BALANCE_LIMIT_EXCEEDED"));
        state("1000", "1000000", 0);
    }

    @Test
    void paidReplaySurvivesLaterExpiryAndFrozenOrSuspendedMerchant() throws Exception {
        var original = data(pay(customer, requestId, "original").andExpect(status().isOk()));
        jdbc.update("UPDATE payment_requests SET expires_at = created_at + interval '1 microsecond'");
        jdbc.update("UPDATE wallets SET status = 'FROZEN'");
        jdbc.update("UPDATE merchants SET status = 'SUSPENDED'");
        assertThat(data(pay(customer, requestId, "original").andExpect(status().isOk()))).isEqualTo(original);
        state("749.75", "250.25", 1);
    }

    @Test
    void cancellationAndExpiryPreventPaymentAndOnlyOwnerCanCancel() throws Exception {
        enroll(other).andExpect(status().isOk());
        write(other, "/merchants/payment-requests/" + requestId + "/cancel", "{}").andExpect(status().isNotFound());
        write(merchant, "/merchants/payment-requests/" + requestId + "/cancel", "{}").andExpect(status().isOk());
        write(merchant, "/merchants/payment-requests/" + requestId + "/cancel", "{}").andExpect(status().isOk());
        pay(customer, requestId, "cancelled").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PAYMENT_REQUEST_CANCELLED"));
        String expired = create("1");
        jdbc.update("UPDATE payment_requests SET expires_at = created_at + interval '1 microsecond' WHERE id = ?::uuid",
                expired);
        read(customer, "/payments/" + expired).andExpect(jsonPath("$.data.status").value("EXPIRED"));
        pay(customer, expired, "expired").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PAYMENT_REQUEST_EXPIRED"));
        state("1000", "0", 0);
    }

    @Test
    void cancellationRacingPaymentHasOnlyOneTerminalOutcome() throws Exception {
        var results = race(() -> code(pay(customer, requestId, "race")),
                () -> code(write(merchant, "/merchants/payment-requests/" + requestId + "/cancel", "{}")));
        assertThat(results).containsExactlyInAnyOrder(200, 409);
        String status = jdbc.queryForObject("SELECT status FROM payment_requests WHERE id = ?::uuid", String.class,
                requestId);
        if (status.equals("PAID"))
            state("749.75", "250.25", 1);
        else {
            assertThat(status).isEqualTo("CANCELLED");
            state("1000", "0", 0);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = { "0", "-1", "0.001", "1.000", "1000000.01", "null", "true" })
    void rejectsInvalidAmounts(String amount) throws Exception {
        write(merchant, "/merchants/payment-requests", "{\"amount\":" + amount + "}")
            .andExpect(status().isBadRequest());
        state("1000", "0", 0);
    }

    @Test
    void validatesKeysRolesPaginationAndUnknownRoutes() throws Exception {
        for (String key : new String[] { "", "bad key", "bad/key", "x".repeat(129) })
            pay(customer, requestId, key).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/payments/" + requestId + "/pay").header("Authorization", "Bearer " + customer))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/payments/" + requestId + "/pay").header("Idempotency-Key", "valid"))
            .andExpect(status().isUnauthorized());
        write(customer, "/merchants/payment-requests", "{\"amount\":1}").andExpect(status().isForbidden());
        read(customer, "/merchants/payments").andExpect(status().isForbidden());
        read(customer, "/merchants/payment-requests").andExpect(status().isForbidden());
        read(merchant, "/merchants/payments?page=-1").andExpect(status().isBadRequest());
        read(merchant, "/merchants/payment-requests?size=101").andExpect(status().isBadRequest());
        pay(customer, UUID.randomUUID().toString(), "missing").andExpect(status().isNotFound());
        pay(customer, "bad-id", "bad").andExpect(status().isBadRequest());
        write(merchant, "/merchant/payment-requests", "{\"amount\":1}").andExpect(status().isForbidden());
        write(merchant, "/merchants/payment-requests", "{\"amount\":1,\"description\":\"" + "x".repeat(256) + "\"}")
            .andExpect(status().isBadRequest());
        write(merchant, "/merchants/payment-requests", "{\"amount\":1,\"expiresAt\":\"2000-01-01T00:00:00Z\"}")
            .andExpect(status().isBadRequest());
        state("1000", "0", 0);
    }

    @ParameterizedTest
    @ValueSource(strings = { "transactions", "payment_requests" })
    void databaseFailureRollsBackBothBalancesReceiptRequestAndKey(String table) throws Exception {
        var balances = jdbc.queryForList("SELECT id, balance, version, updated_at FROM wallets ORDER BY id");
        var records = jdbc.queryForList("SELECT * FROM transactions ORDER BY id");
        var requests = jdbc.queryForList("SELECT * FROM payment_requests ORDER BY id");
        jdbc.execute(
                "CREATE FUNCTION reject_test_payment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected failure'; END; $$");
        try {
            jdbc.execute(
                    "CREATE TRIGGER reject_test_payment BEFORE " + (table.equals("transactions") ? "INSERT" : "UPDATE")
                            + " ON " + table + " FOR EACH ROW EXECUTE FUNCTION reject_test_payment()");
            pay(customer, requestId, "rollback").andExpect(status().isInternalServerError());
            assertThat(jdbc.queryForList("SELECT id, balance, version, updated_at FROM wallets ORDER BY id"))
                .isEqualTo(balances);
            assertThat(jdbc.queryForList("SELECT * FROM transactions ORDER BY id")).isEqualTo(records);
            assertThat(jdbc.queryForList("SELECT * FROM payment_requests ORDER BY id")).isEqualTo(requests);
        }
        finally {
            jdbc.execute("DROP TRIGGER IF EXISTS reject_test_payment ON " + table);
            jdbc.execute("DROP FUNCTION reject_test_payment()");
        }
        pay(customer, requestId, "rollback").andExpect(status().isOk());
        pay(customer, requestId, "rollback").andExpect(status().isOk());
        state("749.75", "250.25", 1);
    }

    @Test
    void openApiShowsPluralContractAndRequiredKey() throws Exception {
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.paths['/api/v1/merchants/payment-requests'].post").exists())
            .andExpect(jsonPath("$.paths['/api/v1/payments/{id}/pay'].post.security[0].bearerAuth").exists())
            .andExpect(jsonPath("$.paths['/api/v1/payments/{id}/pay'].post.parameters[1].required").value(true));
    }

    private void state(String a, String b, long count) {
        assertThat(
                jdbc.queryForObject("SELECT balance FROM wallets WHERE id = ?::uuid", BigDecimal.class, customerWallet))
            .isEqualByComparingTo(a);
        assertThat(
                jdbc.queryForObject("SELECT balance FROM wallets WHERE id = ?::uuid", BigDecimal.class, merchantWallet))
            .isEqualByComparingTo(b);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM transactions WHERE type = 'MERCHANT_PAYMENT'", Long.class))
            .isEqualTo(count);
    }

    private <T> java.util.List<T> race(Callable<T> a, Callable<T> b) throws Exception {
        var barrier = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> {
                barrier.await(10, TimeUnit.SECONDS);
                return a.call();
            });
            var second = pool.submit(() -> {
                barrier.await(10, TimeUnit.SECONDS);
                return b.call();
            });
            return java.util.List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
        }
    }

    private int code(ResultActions r) {
        return r.andReturn().getResponse().getStatus();
    }

    private JsonNode data(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString()).path("data");
    }

    private ResultActions read(String bearer, String path) throws Exception {
        return mvc.perform(get("/api/v1" + path).header("Authorization", "Bearer " + bearer));
    }

    private ResultActions write(String bearer, String path, String body) throws Exception {
        return write(bearer, path, body, "valid");
    }

    private ResultActions write(String bearer, String path, String body, String key) throws Exception {
        return mvc.perform(post("/api/v1" + path).header("Authorization", "Bearer " + bearer)
            .header("Idempotency-Key", key)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
    }

    private ResultActions pay(String bearer, String id, String key) throws Exception {
        return write(bearer, "/payments/" + id + "/pay", "{}", key);
    }

    private ResultActions enroll(String bearer) throws Exception {
        return write(bearer, "/merchants",
                "{\"businessName\":\"Demo Shop\",\"contactEmail\":\"shop@example.com\",\"contactNumber\":\"9812345678\"}");
    }

    private String create(String amount) throws Exception {
        return data(write(merchant, "/merchants/payment-requests",
                "{\"amount\":" + amount + ",\"description\":\"Order #1028\"}")
            .andExpect(status().isOk())).path("paymentRequestId").asText();
    }

    private String wallet(String bearer) throws Exception {
        return data(read(bearer, "/wallet").andExpect(status().isOk())).path("walletId").asText();
    }

    private void fund(String bearer, String amount) throws Exception {
        write(bearer, "/wallet/deposit", "{\"amount\":" + amount + "}", "fund-" + amount).andExpect(status().isOk());
    }

    private String account(String email, String phone) throws Exception {
        mvc.perform(post("/api/v1/auth/register").header("X-PayFlow-CSRF", "1")
            .header("Origin", "https://localhost")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(
                    Map.of("fullName", "Demo User", "email", email, "phone", phone, "password", "Demo-password-123"))))
            .andExpect(status().isCreated());
        return data(mvc
            .perform(post("/api/v1/auth/login").header("X-PayFlow-CSRF", "1")
                .header("Origin", "https://localhost")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "Demo-password-123"))))
            .andExpect(status().isOk())).path("accessToken").asText();
    }

}

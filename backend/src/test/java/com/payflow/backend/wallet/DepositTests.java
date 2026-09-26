package com.payflow.backend.wallet;

import com.payflow.backend.PostgresTestConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(PostgresTestConfiguration.class)
class DepositTests {
    private static final String URL = "/api/v1/wallet/deposit";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    private String token;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE TABLE users, wallets, transactions CASCADE");
        token = account("alice@example.com", "+9779812345678");
    }

    @Test
    void thousandRupeeDepositAndRetriesProduceExactlyOneRecordAndStableReceipt() throws Exception {
        var original = receipt(deposit(token, "1000", "demo-1000").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.amount").value(1000))
                .andExpect(jsonPath("$.data.balanceAfter").value(1000))
                .andExpect(jsonPath("$.data.currency").value("NPR"))
                .andExpect(jsonPath("$.data.type").value("DEPOSIT"))
                .andExpect(jsonPath("$.data.status").value("SUCCESS")));
        assertThat(original.path("reference").asText()).matches("PF-\\d{4}-[a-f0-9-]{36}");
        for (String amount : new String[]{"1000.00", "1000", "1000.0"}) {
            assertThat(receipt(deposit(token, amount, "demo-1000").andExpect(status().isOk())))
                    .isEqualTo(original);
        }
        assertState("1000", 1);
        mvc.perform(get("/api/v1/wallet").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.balance").value(1000));
        deposit(token, "50", "another").andExpect(status().isOk());
        assertThat(receipt(deposit(token, "1000", "demo-1000").andExpect(status().isOk())))
                .isEqualTo(original);
        assertState("1050", 2);
    }

    @Test
    void sameKeyWithDifferentAmountConflicts() throws Exception {
        deposit(token, "1000", "same").andExpect(status().isOk());
        deposit(token, "999", "same").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
        assertState("1000", 1);
    }

    @Test
    void keysAreScopedToTheAuthenticatedWalletAndClientCannotSelectAnotherOwner() throws Exception {
        String other = account("bob@example.com", "+9779812345679");
        deposit(token, "1000", "shared").andExpect(status().isOk());
        mvc.perform(post(URL).header("Authorization", "Bearer " + other)
                        .header("Idempotency-Key", "shared").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":20,\"walletId\":\"ignored\",\"currency\":\"USD\",\"balance\":99999}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.currency").value("NPR"));
        mvc.perform(get("/api/v1/wallet").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.data.balance").value(1000));
        mvc.perform(get("/api/v1/wallet").header("Authorization", "Bearer " + other))
                .andExpect(jsonPath("$.data.balance").value(20));
        assertThat(jdbc.queryForObject("SELECT count(DISTINCT reference) FROM transactions", Long.class)).isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "0", "-1", "0.001", "1.001", "1.000", "100000.01", "1000000000000000000", "1e100", "1e-100", "\"no\"", "true", "{}"})
    void rejectsInvalidAmountsWithoutWrites(String amount) throws Exception {
        deposit(token, amount, "invalid").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        assertState("0", 0);
    }

    @Test
    void acceptsAmountBoundaries() throws Exception {
        deposit(token, "0.01", "minimum").andExpect(status().isOk());
        deposit(token, "100000.00", "maximum").andExpect(status().isOk());
        assertState("100000.01", 2);
    }

    @Test
    void rejectsMissingAndInvalidKeysAndMalformedBodies() throws Exception {
        for (String key : new String[]{"", " ", "has space", "x".repeat(129), "bad/key"}) {
            deposit(token, "1000", key).andExpect(status().isBadRequest());
        }
        mvc.perform(post(URL).header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":1000}"))
                .andExpect(status().isBadRequest());
        for (String body : new String[]{"{}", "null", "{", ""}) {
            mvc.perform(post(URL).header("Authorization", "Bearer " + token).header("Idempotency-Key", "valid")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertState("0", 0);
    }

    @Test
    void rejectsUnauthenticatedAndSuspendedUsers() throws Exception {
        mvc.perform(post(URL).header("Idempotency-Key", "key").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":1000}"))
                .andExpect(status().isUnauthorized());
        jdbc.update("UPDATE users SET status = 'SUSPENDED'");
        deposit(token, "1000", "key").andExpect(status().isUnauthorized());
        assertState("0", 0);
    }

    @Test
    void frozenWalletRejectsNewDepositsButCanReplayAnExistingReceipt() throws Exception {
        var original = receipt(deposit(token, "1000", "original").andExpect(status().isOk()));
        jdbc.update("UPDATE wallets SET status = 'FROZEN', version = version + 1");
        deposit(token, "50", "new").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WALLET_FROZEN"));
        assertThat(receipt(deposit(token, "1000", "original").andExpect(status().isOk()))).isEqualTo(original);
        assertState("1000", 1);
        jdbc.update("UPDATE wallets SET status = 'ACTIVE', version = version + 1");
        deposit(token, "50", "new").andExpect(status().isOk());
        assertState("1050", 2);
    }

    @Test
    void concurrentDuplicateRequestsCreditExactlyOnce() throws Exception {
        var receipts = concurrentDeposits(true, "1000", 8);
        assertThat(receipts).allMatch(receipts.getFirst()::equals);
        assertState("1000", 1);
    }

    @Test
    void concurrentDistinctRequestsDoNotLoseUpdates() throws Exception {
        var receipts = concurrentDeposits(false, "1000", 8);
        assertThat(receipts.stream().map(r -> r.path("reference").asText()).distinct().count()).isEqualTo(8);
        assertState("8000", 8);
    }

    @Test
    void concurrentDifferentAmountsForOneKeyHaveOneWinner() throws Exception {
        var barrier = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { barrier.await(10, TimeUnit.SECONDS); return deposit(token, "1000", "race").andReturn().getResponse().getStatus(); });
            var second = executor.submit(() -> { barrier.await(10, TimeUnit.SECONDS); return deposit(token, "2000", "race").andReturn().getResponse().getStatus(); });
            assertThat(java.util.List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
        }
        assertThat(jdbc.queryForObject("SELECT balance FROM wallets", BigDecimal.class))
                .isEqualByComparingTo(jdbc.queryForObject("SELECT amount FROM transactions", BigDecimal.class));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM transactions", Long.class)).isEqualTo(1);
    }

    @Test
    void balanceLimitIsEnforcedUnderConcurrency() throws Exception {
        concurrentDeposits(false, "100000", 9);
        var barrier = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { barrier.await(10, TimeUnit.SECONDS); return deposit(token, "100000", "last-a").andReturn().getResponse().getStatus(); });
            var second = executor.submit(() -> { barrier.await(10, TimeUnit.SECONDS); return deposit(token, "100000", "last-b").andReturn().getResponse().getStatus(); });
            assertThat(java.util.List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
        }
        deposit(token, "0.01", "overflow").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BALANCE_LIMIT_EXCEEDED"));
        assertState("1000000", 10);
    }

    @Test
    void recordFailureRollsBackFlushedBalanceAndAllowsRetry() throws Exception {
        deposit(token, "25", "existing").andExpect(status().isOk());
        var before = jdbc.queryForMap("SELECT balance, version, updated_at FROM wallets");
        jdbc.execute("""
                CREATE FUNCTION reject_test_deposit() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN RAISE EXCEPTION 'Injected transaction insert failure'; END; $$
                """);
        try {
            jdbc.execute("CREATE TRIGGER reject_test_deposit BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION reject_test_deposit()");
            deposit(token, "1000", "retry").andExpect(status().isInternalServerError())
                    .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));
            assertState("25", 1);
            assertThat(jdbc.queryForMap("SELECT balance, version, updated_at FROM wallets")).isEqualTo(before);
        } finally {
            jdbc.execute("DROP TRIGGER IF EXISTS reject_test_deposit ON transactions");
            jdbc.execute("DROP FUNCTION reject_test_deposit()");
        }
        deposit(token, "1000", "retry").andExpect(status().isOk());
        deposit(token, "1000", "retry").andExpect(status().isOk());
        assertState("1025", 2);
    }

    @Test
    void openApiDocumentsAuthenticatedDepositAndRequiredKey() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/wallet/deposit'].post.security[0].bearerAuth").exists())
                .andExpect(jsonPath("$.paths['/api/v1/wallet/deposit'].post.parameters[0].name").value("Idempotency-Key"))
                .andExpect(jsonPath("$.paths['/api/v1/wallet/deposit'].post.parameters[0].required").value(true));
    }

    private java.util.List<JsonNode> concurrentDeposits(boolean sameKey, String amount, int count) throws Exception {
        var barrier = new CyclicBarrier(count);
        var receipts = new ArrayList<JsonNode>();
        try (var executor = Executors.newFixedThreadPool(count)) {
            var futures = new ArrayList<Future<JsonNode>>();
            for (int i = 0; i < count; i++) {
                String key = sameKey ? "duplicate" : "distinct-" + i;
                futures.add(executor.submit(() -> {
                    barrier.await(10, TimeUnit.SECONDS);
                    return receipt(deposit(token, amount, key).andExpect(status().isOk()));
                }));
            }
            for (var future : futures) receipts.add(future.get(30, TimeUnit.SECONDS));
        }
        return receipts;
    }

    private void assertState(String balance, long records) {
        assertThat(jdbc.queryForObject("SELECT balance FROM wallets", BigDecimal.class)).isEqualByComparingTo(balance);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM transactions", Long.class)).isEqualTo(records);
    }

    private JsonNode receipt(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString()).path("data");
    }

    private ResultActions deposit(String bearer, String amount, String key) throws Exception {
        return mvc.perform(post(URL).header("Authorization", "Bearer " + bearer).header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON).content("{\"amount\":" + amount + "}"));
    }

    private String account(String email, String phone) throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("fullName", "Demo User", "email", email,
                                "phone", phone, "password", "Demo-password-123"))))
                .andExpect(status().isCreated());
        return receipt(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "password", "Demo-password-123"))))
                .andExpect(status().isOk())).path("accessToken").asText();
    }
}

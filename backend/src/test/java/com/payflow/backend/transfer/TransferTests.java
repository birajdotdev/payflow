package com.payflow.backend.transfer;

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
import java.util.Map;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(PostgresTestConfiguration.class)
class TransferTests {
    private static final String URL = "/api/v1/transfers";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    private String token;
    private String bob;
    private String aliceId;
    private String bobId;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE TABLE users, wallets, transactions CASCADE");
        token = account("alice@example.com", "+9779812345678");
        bob = account("bob@example.com", "+9779812345679");
        aliceId = walletId(token);
        bobId = walletId(bob);
        fund(token, "1000");
    }

    @Test
    void acceptanceMilestoneAndStableReplay() throws Exception {
        var original = receipt(transfer(token, bobId, "300", "Dinner", "send").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.senderWalletId").value(aliceId))
                .andExpect(jsonPath("$.data.receiverWalletId").value(bobId))
                .andExpect(jsonPath("$.data.type").value("TRANSFER"))
                .andExpect(jsonPath("$.data.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.currency").value("NPR")));
        for (String amount : new String[]{"300", "300.0", "300.00"}) {
            assertThat(receipt(transfer(token, bobId, amount, "Dinner", "send").andExpect(status().isOk())))
                    .isEqualTo(original);
        }
        state("700", "300", 1);
        fund(token, "10");
        jdbc.update("UPDATE wallets SET status = 'FROZEN', version = version + 1");
        assertThat(receipt(transfer(token, bobId, "300", "Dinner", "send").andExpect(status().isOk())))
                .isEqualTo(original);
        state("710", "300", 1);
    }

    @Test
    void changedPayloadConflictsAndKeysAreScopedBySenderAndOperation() throws Exception {
        transfer(token, bobId, "300", null, "fund-1000").andExpect(status().isOk());
        transfer(token, bobId, "301", null, "fund-1000").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
        transfer(token, bobId, "300", "changed", "fund-1000").andExpect(status().isConflict());
        var third = account("carol@example.com", "+9779812345680");
        transfer(token, walletId(third), "300", null, "fund-1000").andExpect(status().isConflict());
        fund(third, "1000");
        transfer(third, bobId, "100", null, "fund-1000").andExpect(status().isOk());
        transfer(bob, aliceId, "100", null, "fund-1000").andExpect(status().isOk());
        state("800", "300", 3);
    }

    @Test
    void rejectsInsufficientFundsSelfTransfersMissingReceiversAndEitherFrozenWallet() throws Exception {
        transfer(token, bobId, "1000.01", null, "retry").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_BALANCE"));
        transfer(token, aliceId, "1", null, "self").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SELF_TRANSFER"));
        transfer(token, java.util.UUID.randomUUID().toString(), "1", null, "missing").andExpect(status().isNotFound());
        for (String id : new String[]{aliceId, bobId}) {
            jdbc.update("UPDATE wallets SET status = 'FROZEN' WHERE id = ?::uuid", id);
            transfer(token, bobId, "1", null, "frozen").andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("WALLET_FROZEN"));
            jdbc.update("UPDATE wallets SET status = 'ACTIVE' WHERE id = ?::uuid", id);
        }
        state("1000", "0", 0);
        fund(token, "1");
        transfer(token, bobId, "1000.01", null, "retry").andExpect(status().isOk());
        state("0.99", "1000.01", 1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "0", "-1", "0.001", "1.000", "1000000.01", "1e100", "1e-100", "true", "{}"})
    void rejectsInvalidAmount(String amount) throws Exception {
        transfer(token, bobId, amount, null, "invalid").andExpect(status().isBadRequest());
        state("1000", "0", 0);
    }

    @Test
    void validatesKeysBodiesAndAuthentication() throws Exception {
        for (String key : new String[]{"", " ", "bad/key", "x".repeat(129)}) {
            transfer(token, bobId, "1", null, key).andExpect(status().isBadRequest());
        }
        mvc.perform(post(URL).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"receiverWalletId\":\"" + bobId + "\",\"amount\":1}" )).andExpect(status().isBadRequest());
        for (String body : new String[]{"{}", "null", "{", "", "{\"receiverWalletId\":\"bad\",\"amount\":1}", "{\"amount\":1}"}) {
            mvc.perform(post(URL).header("Authorization", "Bearer " + token).header("Idempotency-Key", "valid")
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        transfer(token, bobId, "1", "x".repeat(256), "long").andExpect(status().isBadRequest());
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        jdbc.update("UPDATE users SET status = 'SUSPENDED'");
        transfer(token, bobId, "1", null, "auth").andExpect(status().isUnauthorized());
        state("1000", "0", 0);
    }

    @Test
    void concurrentRetriesTransferOnce() throws Exception {
        var results = race(
                () -> receipt(transfer(token, bobId, "300", null, "same").andExpect(status().isOk())),
                () -> receipt(transfer(token, bobId, "300.00", null, "same").andExpect(status().isOk())));
        assertThat(results.get(0)).isEqualTo(results.get(1));
        state("700", "300", 1);
    }

    @Test
    void concurrentSpendingToDifferentReceiversCannotOverdraw() throws Exception {
        String carolId = walletId(account("carol@example.com", "+9779812345680"));
        var results = race(
                () -> transfer(token, bobId, "800", null, "a").andReturn().getResponse().getStatus(),
                () -> transfer(token, carolId, "700", null, "b").andReturn().getResponse().getStatus());
        assertThat(results).containsExactlyInAnyOrder(200, 409);
        assertThat(jdbc.queryForObject("SELECT balance FROM wallets WHERE id = ?::uuid", BigDecimal.class, aliceId))
                .isIn(new BigDecimal("200.00"), new BigDecimal("300.00"));
        assertThat(jdbc.queryForObject("SELECT sum(balance) FROM wallets", BigDecimal.class)).isEqualByComparingTo("1000");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM transactions WHERE type = 'TRANSFER'", Long.class)).isEqualTo(1);
    }

    @Test
    void oppositeDirectionTransfersFinishWithoutDeadlock() throws Exception {
        fund(bob, "1000");
        for (int i = 0; i < 8; i++) {
            String key = "opposite-" + i;
            assertThat(race(
                    () -> transfer(token, bobId, "30", null, key).andReturn().getResponse().getStatus(),
                    () -> transfer(bob, aliceId, "20", null, key).andReturn().getResponse().getStatus()))
                    .containsOnly(200);
        }
        state("920", "1080", 16);
    }

    @Test
    void concurrentConflictingPayloadsHaveOneWinner() throws Exception {
        assertThat(race(
                () -> transfer(token, bobId, "300", null, "same").andReturn().getResponse().getStatus(),
                () -> transfer(token, bobId, "400", null, "same").andReturn().getResponse().getStatus()))
                .containsExactlyInAnyOrder(200, 409);
        assertThat(jdbc.queryForObject("SELECT sum(balance) FROM wallets", BigDecimal.class)).isEqualByComparingTo("1000");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM transactions WHERE type = 'TRANSFER'", Long.class)).isEqualTo(1);
    }

    @Test
    void recordFailureRollsBackBothFlushedBalancesAndKey() throws Exception {
        var before = jdbc.queryForList("SELECT id, balance, version, updated_at FROM wallets ORDER BY id");
        var records = jdbc.queryForList("SELECT * FROM transactions ORDER BY id");
        jdbc.execute("CREATE FUNCTION reject_test_transfer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected failure'; END; $$");
        try {
            jdbc.execute("CREATE TRIGGER reject_test_transfer BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION reject_test_transfer()");
            transfer(token, bobId, "300", null, "retry").andExpect(status().isInternalServerError());
            assertThat(jdbc.queryForList("SELECT id, balance, version, updated_at FROM wallets ORDER BY id")).isEqualTo(before);
            assertThat(jdbc.queryForList("SELECT * FROM transactions ORDER BY id")).isEqualTo(records);
        } finally {
            jdbc.execute("DROP TRIGGER IF EXISTS reject_test_transfer ON transactions");
            jdbc.execute("DROP FUNCTION reject_test_transfer()");
        }
        transfer(token, bobId, "300", null, "retry").andExpect(status().isOk());
        transfer(token, bobId, "300", null, "retry").andExpect(status().isOk());
        state("700", "300", 1);
    }

    @Test
    void receiverBalanceLimitDoesNotDebitSender() throws Exception {
        for (int i = 0; i < 10; i++) deposit(bob, "100000", "fund-" + i).andExpect(status().isOk());
        transfer(token, bobId, "0.01", null, "overflow").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BALANCE_LIMIT_EXCEEDED"));
        state("1000", "1000000", 0);
    }

    @Test
    void openApiDocumentsRequiredKeyAndAuthentication() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/transfers'].post.security[0].bearerAuth").exists())
                .andExpect(jsonPath("$.paths['/api/v1/transfers'].post.parameters[0].required").value(true));
    }

    private <T> java.util.List<T> race(java.util.concurrent.Callable<T> a, java.util.concurrent.Callable<T> b) throws Exception {
        var barrier = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { barrier.await(10, TimeUnit.SECONDS); return a.call(); });
            var second = executor.submit(() -> { barrier.await(10, TimeUnit.SECONDS); return b.call(); });
            return java.util.List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
        }
    }

    private void state(String aliceBalance, String bobBalance, long transfers) throws Exception {
        assertThat(jdbc.queryForObject("SELECT balance FROM wallets WHERE id = ?::uuid", BigDecimal.class, aliceId)).isEqualByComparingTo(aliceBalance);
        assertThat(jdbc.queryForObject("SELECT balance FROM wallets WHERE id = ?::uuid", BigDecimal.class, bobId)).isEqualByComparingTo(bobBalance);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM transactions WHERE type = 'TRANSFER'", Long.class)).isEqualTo(transfers);
    }

    private String walletId(String bearer) throws Exception {
        return receipt(mvc.perform(get("/api/v1/wallet").header("Authorization", "Bearer " + bearer))
                .andExpect(status().isOk())).path("walletId").asText();
    }

    private void fund(String bearer, String amount) throws Exception {
        deposit(bearer, amount, "fund-" + amount).andExpect(status().isOk());
    }

    private ResultActions transfer(String bearer, String receiver, String amount, String description, String key) throws Exception {
        return mvc.perform(post(URL).header("Authorization", "Bearer " + bearer).header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON).content("{\"receiverWalletId\":\"" + receiver
                        + "\",\"amount\":" + amount + ",\"description\":" + json.writeValueAsString(description) + "}"));
    }

    private JsonNode receipt(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString()).path("data");
    }

    private ResultActions deposit(String bearer, String amount, String key) throws Exception {
        return mvc.perform(post("/api/v1/wallet/deposit").header("Authorization", "Bearer " + bearer).header("Idempotency-Key", key)
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

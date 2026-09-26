package com.payflow.backend.transaction;

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

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(PostgresTestConfiguration.class)
class TransactionTests {
    private static final String URL = "/api/v1/transactions";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    private String token;
    private String bob;
    private String aliceId;
    private String bobId;

    private String carol;
    private String depositId;
    private String transferId;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE TABLE users, wallets, transactions CASCADE");
        token = account("alice@example.com", "+9779812345678");
        bob = account("bob@example.com", "+9779812345679");
        carol = account("carol@example.com", "+9779812345680");
        aliceId = walletId(token);
        bobId = walletId(bob);
        depositId = receipt(deposit(token, "1000", "fund").andExpect(status().isOk())).path("transactionId").asText();
        transferId = receipt(transfer(token, bobId, "300", "Dinner", "send").andExpect(status().isOk())).path("transactionId").asText();
    }

    @Test
    void aliceSeesDepositAndOutgoingTransferBobSeesIncomingAndBothCanReadReceipt() throws Exception {
        var alice = receipt(history(token).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(20))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.hasNext").value(false)));
        assertThat(alice.path("content").get(0).path("transactionId").asText()).isEqualTo(transferId);
        assertThat(alice.path("content").get(1).path("transactionId").asText()).isEqualTo(depositId);
        var incoming = receipt(history(bob).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))).path("content").get(0);
        assertThat(incoming).isEqualTo(alice.path("content").get(0));
        assertThat(receipt(detail(token, transferId).andExpect(status().isOk()))).isEqualTo(incoming);
        assertThat(receipt(detail(bob, transferId).andExpect(status().isOk()))).isEqualTo(incoming);
        assertThat(incoming.path("senderWalletId").asText()).isEqualTo(aliceId);
        assertThat(incoming.path("receiverWalletId").asText()).isEqualTo(bobId);
        assertThat(incoming.path("amount").decimalValue()).isEqualByComparingTo("300");
        assertThat(incoming.path("description").asText()).isEqualTo("Dinner");
        assertThat(incoming.has("idempotencyKey")).isFalse();
        assertThat(incoming.has("balanceAfter")).isFalse();
        assertThat(incoming.has("user")).isFalse();
        detail(token, depositId).andExpect(status().isOk()).andExpect(jsonPath("$.data.type").value("DEPOSIT"));
        history(carol).andExpect(status().isOk()).andExpect(jsonPath("$.data.content").isEmpty())
                .andExpect(jsonPath("$.data.totalElements").value(0));
    }

    @Test
    void unrelatedAndMissingReceiptsAreIndistinguishableAndAdminStillHasOwnWalletScope() throws Exception {
        for (String id : new String[]{transferId, depositId, java.util.UUID.randomUUID().toString()}) {
            detail(carol, id).andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TRANSACTION_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("Transaction not found."));
        }
        detail(bob, depositId).andExpect(status().isNotFound());
        jdbc.update("UPDATE users SET role = 'ADMIN' WHERE email = 'carol@example.com'");
        history(carol, "walletId", aliceId, "userId", aliceId).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));
        detail(carol, transferId).andExpect(status().isNotFound());
    }

    @Test
    void filtersCombineWithOwnershipAndIncludeStartButExcludeEnd() throws Exception {
        fund(carol, "1000");
        jdbc.update("UPDATE transactions SET created_at = '2026-09-01T00:00:00Z' WHERE id = ?::uuid", depositId);
        jdbc.update("UPDATE transactions SET created_at = '2026-09-02T00:00:00Z' WHERE id = ?::uuid", transferId);
        history(token, "type", "TRANSFER", "status", "SUCCESS", "fromDate", "2026-09-02T00:00:00Z",
                "toDate", "2026-09-03T00:00:00Z").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].transactionId").value(transferId));
        history(token, "toDate", "2026-09-02T00:00:00Z").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].transactionId").value(depositId))
                .andExpect(jsonPath("$.data.totalElements").value(1));
        history(token, "fromDate", "2026-09-02T05:45:00+05:45").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1));
        history(bob, "type", "DEPOSIT").andExpect(status().isOk()).andExpect(jsonPath("$.data.content").isEmpty());
        for (String status : new String[]{"PENDING", "FAILED", "REFUNDED"}) {
            history(token, "status", status).andExpect(status().isOk()).andExpect(jsonPath("$.data.content").isEmpty());
        }
        // A non-success fixture ensures the status predicate excludes it, too.
        jdbc.update("UPDATE transactions SET status = 'REFUNDED' WHERE id = ?::uuid", transferId);
        history(token, "status", "SUCCESS").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].transactionId").value(depositId));
    }

    @Test
    void paginationHasStableTieOrderingAndOwnerScopedCounts() throws Exception {
        fund(token, "1");
        fund(carol, "10");
        jdbc.update("UPDATE transactions SET created_at = '2026-09-01T00:00:00Z'");
        var expected = jdbc.queryForList("SELECT id::text FROM transactions WHERE sender_wallet_id = ?::uuid OR receiver_wallet_id = ?::uuid ORDER BY created_at DESC, id DESC", String.class, aliceId, aliceId);
        for (int i = 0; i < 3; i++) {
            history(token, "page", "" + i, "size", "1").andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content.length()").value(1))
                    .andExpect(jsonPath("$.data.content[0].transactionId").value(expected.get(i)))
                    .andExpect(jsonPath("$.data.page").value(i))
                    .andExpect(jsonPath("$.data.totalElements").value(3))
                    .andExpect(jsonPath("$.data.totalPages").value(3))
                    .andExpect(jsonPath("$.data.hasNext").value(i < 2));
        }
        history(token, "page", "3", "size", "1").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isEmpty()).andExpect(jsonPath("$.data.totalElements").value(3))
                .andExpect(jsonPath("$.data.hasNext").value(false));
        history(token, "size", "100").andExpect(status().isOk()).andExpect(jsonPath("$.data.content.length()").value(3));
    }

    @ParameterizedTest
    @ValueSource(strings = {"page=-1", "page=abc", "page=2147483647", "size=0", "size=-1", "size=101", "size=abc",
            "type=OTHER", "status=OTHER", "fromDate=invalid", "toDate=2026-09-01", "fromDate=2026-09-01T00:00:00"})
    void rejectsInvalidFiltersAndPagination(String pair) throws Exception {
        var parts = pair.split("=", 2);
        history(token, parts[0], parts[1]).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void rejectsInvalidRangeAndMalformedId() throws Exception {
        for (String end : new String[]{"2026-09-01T00:00:00Z", "2026-08-01T00:00:00Z"}) {
            history(token, "fromDate", "2026-09-01T00:00:00Z", "toDate", end).andExpect(status().isBadRequest());
        }
        detail(token, "bad-id").andExpect(status().isBadRequest());
    }

    @Test
    void readsAreAuthenticatedFrozenWalletsRemainReadableAndSuspensionRevokesAccess() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(get(URL + "/" + transferId)).andExpect(status().isUnauthorized());
        jdbc.update("UPDATE wallets SET status = 'FROZEN'");
        history(token).andExpect(status().isOk());
        detail(token, transferId).andExpect(status().isOk());
        jdbc.update("UPDATE users SET status = 'SUSPENDED'");
        history(token).andExpect(status().isUnauthorized());
        detail(token, transferId).andExpect(status().isUnauthorized());
    }

    @Test
    void readsDoNotChangeFinancialRecordsAndWriteRoutesRemainDenied() throws Exception {
        var walletsBefore = jdbc.queryForList("SELECT * FROM wallets ORDER BY id");
        var recordsBefore = jdbc.queryForList("SELECT * FROM transactions ORDER BY id");
        history(token).andExpect(status().isOk());
        detail(token, transferId).andExpect(status().isOk());
        mvc.perform(delete(URL + "/" + transferId).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        assertThat(jdbc.queryForList("SELECT * FROM wallets ORDER BY id")).isEqualTo(walletsBefore);
        assertThat(jdbc.queryForList("SELECT * FROM transactions ORDER BY id")).isEqualTo(recordsBefore);
    }

    @Test
    void openApiDocumentsBothProtectedEndpoints() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/transactions'].get.security[0].bearerAuth").exists())
                .andExpect(jsonPath("$.paths['/api/v1/transactions/{id}'].get.security[0].bearerAuth").exists())
                .andExpect(jsonPath("$.paths['/api/v1/transactions'].get.parameters.length()").value(6));
    }

    private ResultActions history(String bearer, String... params) throws Exception {
        var request = get(URL).header("Authorization", "Bearer " + bearer);
        for (int i = 0; i < params.length; i += 2) request.param(params[i], params[i + 1]);
        return mvc.perform(request);
    }

    private ResultActions detail(String bearer, String id) throws Exception {
        return mvc.perform(get(URL + "/" + id).header("Authorization", "Bearer " + bearer));
    }

    private String walletId(String bearer) throws Exception {
        return receipt(mvc.perform(get("/api/v1/wallet").header("Authorization", "Bearer " + bearer))
                .andExpect(status().isOk())).path("walletId").asText();
    }

    private void fund(String bearer, String amount) throws Exception {
        deposit(bearer, amount, "fund-" + amount).andExpect(status().isOk());
    }

    private ResultActions transfer(String bearer, String receiver, String amount, String description, String key) throws Exception {
        return mvc.perform(post("/api/v1/transfers").header("Authorization", "Bearer " + bearer).header("Idempotency-Key", key)
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

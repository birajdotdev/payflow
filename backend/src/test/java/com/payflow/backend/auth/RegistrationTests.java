package com.payflow.backend.auth;

import com.payflow.backend.PostgresTestConfiguration;
import com.payflow.backend.user.User;
import com.payflow.backend.user.UserRepository;
import com.payflow.backend.user.UserRole;
import com.payflow.backend.user.UserStatus;
import com.payflow.backend.wallet.Wallet;
import com.payflow.backend.wallet.WalletRepository;
import com.payflow.backend.wallet.WalletStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(PostgresTestConfiguration.class)
class RegistrationTests {
    private static final String PASSWORD = "Demo-password-123";
    private static final String REGISTER = "/api/v1/auth/register";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired WalletRepository wallets;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void clearIsolatedDatabase() {
        jdbc.execute("TRUNCATE TABLE wallets, users CASCADE");
    }

    @Test
    void createsUserAndOneZeroBalanceWalletWithoutExposingCredentials() throws Exception {
        Map<String, Object> body = validRequest();
        body.put("fullName", "  Demo User  ");
        body.put("email", "  DEMO@Example.com  ");
        body.put("phone", "  +9779812345678  ");
        String response = register(body)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.data.fullName").value("Demo User"))
                .andExpect(jsonPath("$.data.email").value("demo@example.com"))
                .andExpect(jsonPath("$.data.phone").value("+9779812345678"))
                .andExpect(jsonPath("$.data.role").value("USER"))
                .andExpect(jsonPath("$.data.password").doesNotExist())
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        assertThat(users.count()).isEqualTo(1);
        assertThat(wallets.count()).isEqualTo(1);
        User user = users.findByEmail("demo@example.com").orElseThrow();
        Wallet wallet = wallets.findByUser_Id(user.getId()).orElseThrow();
        assertThat(user.getRole()).isEqualTo(UserRole.USER);
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getPasswordHash()).startsWith("$2").isNotEqualTo(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
        assertThat(wallet.getBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.getCurrency()).isEqualTo("NPR");
        assertThat(wallet.getStatus()).isEqualTo(WalletStatus.ACTIVE);
        assertThat(wallet.getVersion()).isZero();
        assertThat(user.getCreatedAt()).isNotNull();
        assertThat(wallet.getCreatedAt()).isNotNull();
        assertThat(json.readTree(response).at("/data/userId").asText()).isEqualTo(user.getId().toString());
        assertThat(json.readTree(response).at("/data/walletId").asText()).isEqualTo(wallet.getId().toString());
        assertThat(response).doesNotContain(PASSWORD, user.getPasswordHash());
    }

    @Test
    void duplicateEmailIsCaseInsensitiveAndDoesNotCreateAnOrphanWallet() throws Exception {
        register(validRequest()).andExpect(status().isCreated());
        Map<String, Object> duplicate = validRequest();
        duplicate.put("email", " DEMO@EXAMPLE.COM ");
        duplicate.put("phone", "+9779812345679");
        assertConflict(duplicate);
    }

    @Test
    void databaseAlsoEnforcesNormalizedEmailForExistingMixedCaseData() throws Exception {
        register(validRequest()).andExpect(status().isCreated());
        jdbc.update("UPDATE users SET email = ?", " DEMO@EXAMPLE.COM ");
        Map<String, Object> duplicate = validRequest();
        duplicate.put("phone", "+9779812345679");
        assertConflict(duplicate);
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void duplicatePhoneReturnsTheSameGenericConflictAsDuplicateEmail(CapturedOutput output) throws Exception {
        register(validRequest()).andExpect(status().isCreated());
        Map<String, Object> duplicate = validRequest();
        duplicate.put("email", "another@example.com");
        assertConflict(duplicate);
        assertThat(output.getAll()).doesNotContain("+9779812345678", "another@example.com", PASSWORD);
    }

    @Test
    void concurrentDuplicateRegistrationsCreateOnlyOneUserAndWallet() throws Exception {
        CyclicBarrier start = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await(10, TimeUnit.SECONDS);
                return register(validRequest()).andReturn().getResponse().getStatus();
            });
            var second = executor.submit(() -> {
                Map<String, Object> body = validRequest();
                body.put("email", "DEMO@EXAMPLE.COM");
                body.put("phone", "+9779812345679");
                start.await(10, TimeUnit.SECONDS);
                return register(body).andReturn().getResponse().getStatus();
            });
            assertThat(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(201, 409);
        }
        assertThat(users.count()).isEqualTo(1);
        assertThat(wallets.count()).isEqualTo(1);
    }

    @Test
    void databaseWalletFailureRollsBackTheUserInsertAndPreservesExistingAccounts() throws Exception {
        register(validRequest()).andExpect(status().isCreated());
        User existing = users.findByEmail("demo@example.com").orElseThrow();
        jdbc.execute("""
                CREATE FUNCTION reject_test_wallet() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'Injected wallet insert failure';
                END;
                $$
                """);
        try {
            jdbc.execute("""
                    CREATE TRIGGER reject_test_wallet BEFORE INSERT ON wallets
                    FOR EACH ROW EXECUTE FUNCTION reject_test_wallet()
                    """);
            Map<String, Object> body = validRequest();
            body.put("email", "rollback@example.com");
            body.put("phone", "+9779812345679");
            register(body)
                    .andExpect(status().isInternalServerError())
                    .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                    .andExpect(content().string(org.hamcrest.Matchers.not(
                            org.hamcrest.Matchers.containsString("Injected"))));

            assertThat(users.findByEmail("rollback@example.com")).isEmpty();
            assertThat(users.count()).isEqualTo(1);
            assertThat(wallets.count()).isEqualTo(1);
            assertThat(wallets.findByUser_Id(existing.getId())).isPresent();
        } finally {
            jdbc.execute("DROP TRIGGER IF EXISTS reject_test_wallet ON wallets");
            jdbc.execute("DROP FUNCTION reject_test_wallet()");
        }
    }

    @ParameterizedTest
    @MethodSource("invalidFields")
    void invalidInputReturns400WithoutWritingAnyData(String field, Object value) throws Exception {
        Map<String, Object> body = validRequest();
        body.put(field, value);
        register(body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
        assertThat(users.count()).isZero();
        assertThat(wallets.count()).isZero();
    }

    static Stream<Arguments> invalidFields() {
        return Stream.of(
                Arguments.of("fullName", null),
                Arguments.of("fullName", "   "),
                Arguments.of("fullName", "x".repeat(101)),
                Arguments.of("email", null),
                Arguments.of("email", "invalid"),
                Arguments.of("email", "x".repeat(250) + "@example.com"),
                Arguments.of("phone", null),
                Arguments.of("phone", "9812345678"),
                Arguments.of("phone", "+0123456789"),
                Arguments.of("phone", "+977-9812345678"),
                Arguments.of("phone", "+1234567890123456"),
                Arguments.of("password", null),
                Arguments.of("password", "       "),
                Arguments.of("password", "short"),
                Arguments.of("password", "x".repeat(73)),
                Arguments.of("password", "€".repeat(25)));
    }

    @ParameterizedTest
    @MethodSource("boundaryPasswords")
    void acceptsPasswordsAtBcryptByteLimit(String password) throws Exception {
        Map<String, Object> body = validRequest();
        body.put("password", password);
        register(body).andExpect(status().isCreated());
        assertThat(passwordEncoder.matches(password,
                users.findByEmail("demo@example.com").orElseThrow().getPasswordHash())).isTrue();
    }

    static Stream<String> boundaryPasswords() {
        return Stream.of("x".repeat(72), "€".repeat(24));
    }

    @Test
    void clientCannotChoosePrivilegedRoleOrStartingBalance() throws Exception {
        Map<String, Object> body = validRequest();
        body.put("role", "ADMIN");
        body.put("balance", 1000000);
        register(body).andExpect(status().isCreated()).andExpect(jsonPath("$.data.role").value("USER"));
        assertThat(users.findAll().getFirst().getRole()).isEqualTo(UserRole.USER);
        assertThat(wallets.findAll().getFirst().getBalance()).isEqualByComparingTo("0.00");
    }

    @Test
    void malformedJsonReturnsSafe400() throws Exception {
        mvc.perform(post(REGISTER).contentType(MediaType.APPLICATION_JSON).content("{\"password\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        assertThat(users.count()).isZero();
    }

    @Test
    void otherApiRoutesRemainClosed() throws Exception {
        mvc.perform(get("/api/v1/wallet"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void openApiDocumentsRegistration() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/auth/register'].post").exists());
    }

    private void assertConflict(Map<String, Object> request) throws Exception {
        register(request)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("REGISTRATION_CONFLICT"))
                .andExpect(jsonPath("$.message").value("Unable to register with the supplied details."));
        assertThat(users.count()).isEqualTo(1);
        assertThat(wallets.count()).isEqualTo(1);
    }

    private ResultActions register(Map<String, Object> request) throws Exception {
        return mvc.perform(post(REGISTER).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request)));
    }

    private static Map<String, Object> validRequest() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("fullName", "Demo User");
        body.put("email", "demo@example.com");
        body.put("phone", "+9779812345678");
        body.put("password", PASSWORD);
        return body;
    }
}

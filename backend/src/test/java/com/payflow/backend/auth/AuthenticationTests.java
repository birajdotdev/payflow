package com.payflow.backend.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.payflow.backend.PostgresTestConfiguration;
import com.payflow.backend.auth.security.AccountJwtAuthenticationConverter;
import com.payflow.backend.auth.security.JwtProperties;
import com.payflow.backend.wallet.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.spec.SecretKeySpec;
import java.time.Instant;
import java.util.List;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(PostgresTestConfiguration.class)
class AuthenticationTests {
    private static final String EMAIL = "alice@example.com";
    private static final String PASSWORD = "Alice-password-123";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtDecoder decoder;
    @Autowired JwtEncoder encoder;
    @Autowired JwtProperties properties;
    @Autowired AccountJwtAuthenticationConverter converter;
    @Autowired WalletService walletService;
    @Autowired CurrentUserService currentUserService;

    @BeforeEach
    void clearIsolatedDatabase() {
        jdbc.execute("TRUNCATE TABLE wallets, users CASCADE");
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void registrationLoginProfileAndWalletWorkWithARealSignedToken(CapturedOutput output) throws Exception {
        JsonNode registered = register(EMAIL, "+9779812345678");
        var result = login(" ALICE@EXAMPLE.COM ", PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.expiresIn").value(900))
                .andExpect(jsonPath("$.data.user.userId").value(registered.path("userId").asText()))
                .andExpect(jsonPath("$.data.user.role").value("USER"))
                .andExpect(jsonPath("$.data.user.passwordHash").doesNotExist())
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")))
                .andReturn();
        JsonNode loggedIn = json.readTree(result.getResponse().getContentAsString()).path("data");
        String token = loggedIn.path("accessToken").asText();
        Jwt jwt = decoder.decode(token);
        assertThat(jwt.getSubject()).isEqualTo(registered.path("userId").asText());
        assertThat(jwt.getClaimAsString("iss")).isEqualTo(properties.issuer());
        assertThat(jwt.getAudience()).containsExactly(properties.audience());
        assertThat(jwt.getExpiresAt()).isEqualTo(Instant.parse(loggedIn.path("expiresAt").asText()));
        assertThat(jwt.getExpiresAt().getEpochSecond() - jwt.getIssuedAt().getEpochSecond()).isEqualTo(900);
        assertThat(jwt.getClaims()).doesNotContainKeys("password", "passwordHash", "email", "phone");

        mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(registered.path("userId").asText()))
                .andExpect(jsonPath("$.data.email").value(EMAIL))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist());
        mvc.perform(get("/api/v1/wallet").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.walletId").value(registered.path("walletId").asText()))
                .andExpect(jsonPath("$.data.balance").value(0))
                .andExpect(jsonPath("$.data.currency").value("NPR"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.user").doesNotExist());
        assertThat(output.getAll()).doesNotContain(token, PASSWORD);
    }

    @Test
    void loginFindsExistingMixedCaseEmailRecords() throws Exception {
        register(EMAIL, "+9779812345678");
        jdbc.update("UPDATE users SET email = ?", " ALICE@EXAMPLE.COM ");
        login(EMAIL, PASSWORD).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"wrong-password", "unknown-account", "suspended-account"})
    void failedCredentialsHaveTheSameGenericResponse(String scenario) throws Exception {
        register(EMAIL, "+9779812345678");
        if (scenario.equals("suspended-account")) {
            jdbc.update("UPDATE users SET status = 'SUSPENDED'");
        }
        login(scenario.equals("unknown-account") ? "missing@example.com" : EMAIL,
                scenario.equals("wrong-password") ? "Wrong-password-123" : PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("Invalid email or password."))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void invalidLoginInputReturns400() throws Exception {
        login("invalid", PASSWORD).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        login(EMAIL, "€".repeat(25)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/auth/me", "/api/v1/wallet"})
    void privateEndpointsRequireBearerAuthenticationOnEveryRequest(String path) throws Exception {
        register(EMAIL, "+9779812345678");
        String token = accessToken();
        mvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)).andExpect(status().isOk());
        mvc.perform(get(path))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get(path).param("access_token", token)).andExpect(status().isUnauthorized());
    }

    @Test
    void walletAndProfileCannotBeRedirectedToAnotherOwner() throws Exception {
        JsonNode alice = register(EMAIL, "+9779812345678");
        JsonNode bob = register("bob@example.com", "+9779812345679");
        String token = accessToken();
        mvc.perform(get("/api/v1/wallet")
                        .param("userId", bob.path("userId").asText())
                        .param("walletId", bob.path("walletId").asText())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.walletId").value(alice.path("walletId").asText()));
        mvc.perform(get("/api/v1/auth/me").param("userId", bob.path("userId").asText())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(alice.path("userId").asText()));
        mvc.perform(get("/api/v1/wallet/" + bob.path("walletId").asText())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"expired", "future-nbf", "wrong-issuer", "wrong-audience", "missing-expiry",
            "missing-subject", "invalid-subject", "missing-iat", "future-iat", "nonexistent-user",
            "wrong-signature", "wrong-algorithm", "malformed", "unsigned"})
    void rejectsInvalidTokens(String scenario) throws Exception {
        JsonNode user = register(EMAIL, "+9779812345678");
        Instant now = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .subject(user.path("userId").asText())
                .issuer(properties.issuer()).audience(List.of(properties.audience()))
                .issuedAt(now.minusSeconds(600)).notBefore(now.minusSeconds(600)).expiresAt(now.plusSeconds(600));
        switch (scenario) {
            case "expired" -> claims.expiresAt(now.minusSeconds(120));
            case "future-nbf" -> claims.notBefore(now.plusSeconds(120));
            case "wrong-issuer" -> claims.issuer("another-issuer");
            case "wrong-audience" -> claims.audience(List.of("another-api"));
            case "missing-expiry" -> claims.claims(values -> values.remove("exp"));
            case "missing-subject" -> claims.claims(values -> values.remove("sub"));
            case "invalid-subject" -> claims.subject("not-a-uuid");
            case "missing-iat" -> claims.claims(values -> values.remove("iat"));
            case "future-iat" -> claims.issuedAt(now.plusSeconds(120));
            case "nonexistent-user" -> claims.subject(UUID.randomUUID().toString());
            default -> { }
        }
        JwtEncoder signingEncoder = encoder;
        MacAlgorithm algorithm = MacAlgorithm.HS256;
        if (scenario.equals("wrong-signature") || scenario.equals("wrong-algorithm")) {
            byte[] key = new byte[64];
            if (scenario.equals("wrong-algorithm")) {
                algorithm = MacAlgorithm.HS384;
                key = Base64.getDecoder().decode(properties.secret());
            }
            signingEncoder = new NimbusJwtEncoder(new ImmutableSecret<>(
                    new SecretKeySpec(key, algorithm.equals(MacAlgorithm.HS384) ? "HmacSHA384" : "HmacSHA256")));
        }
        String token = signingEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(algorithm).build(), claims.build())).getTokenValue();
        if (scenario.equals("malformed")) {
            token = "not.a.jwt";
        } else if (scenario.equals("unsigned")) {
            token = "eyJhbGciOiJub25lIn0." + token.split("\\.")[1] + ".";
        }
        for (String path : List.of("/api/v1/auth/me", "/api/v1/wallet")) {
            mvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                    .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"suspend", "delete"})
    void existingTokenStopsWorkingWhenAccountBecomesUnavailable(String action) throws Exception {
        register(EMAIL, "+9779812345678");
        String token = accessToken();
        if (action.equals("suspend")) {
            jdbc.update("UPDATE users SET status = 'SUSPENDED'");
        } else {
            jdbc.update("DELETE FROM wallets");
            jdbc.update("DELETE FROM users");
        }
        for (String path : List.of("/api/v1/auth/me", "/api/v1/wallet")) {
            mvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void currentDatabaseRoleOverridesStaleOrForgedRoleClaims() throws Exception {
        register(EMAIL, "+9779812345678");
        jdbc.update("UPDATE users SET role = 'ADMIN'");
        String adminToken = accessToken();
        jdbc.update("UPDATE users SET role = 'USER'");
        Jwt jwt = decoder.decode(adminToken);
        assertThat(jwt.getClaimAsString("role")).isEqualTo("ADMIN");
        assertThat(converter.convert(jwt).getAuthorities())
                .containsExactly(new SimpleGrantedAuthority("ROLE_USER"));
        mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value("USER"));
        mvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void walletServiceAlsoRequiresAuthenticationOutsideTheController() {
        assertThatThrownBy(() -> walletService.currentWallet())
                .isInstanceOf(AuthenticationCredentialsNotFoundException.class);
        assertThatThrownBy(() -> currentUserService.profile())
                .isInstanceOf(AuthenticationCredentialsNotFoundException.class);
    }

    @Test
    void frozenWalletRemainsReadable() throws Exception {
        register(EMAIL, "+9779812345678");
        jdbc.update("UPDATE wallets SET status = 'FROZEN'");
        mvc.perform(get("/api/v1/wallet").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("FROZEN"));
    }

    @Test
    void openApiDescribesBearerAuthenticationAndProtectedOperations() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/me'].get.security[0].bearerAuth").isArray())
                .andExpect(jsonPath("$.paths['/api/v1/wallet'].get.security[0].bearerAuth").isArray());
    }

    private JsonNode register(String email, String phone) throws Exception {
        String response = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("fullName", "Demo User", "email", email,
                                "phone", phone, "password", PASSWORD))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).path("data");
    }

    private ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", password))));
    }

    private String accessToken() throws Exception {
        String response = login(EMAIL, PASSWORD).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).at("/data/accessToken").asText();
    }
}

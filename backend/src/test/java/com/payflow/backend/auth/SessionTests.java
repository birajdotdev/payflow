package com.payflow.backend.auth;

import com.payflow.backend.PostgresTestConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(PostgresTestConfiguration.class)
class SessionTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired org.springframework.security.oauth2.jwt.JwtDecoder decoder;
    @Autowired org.springframework.security.oauth2.jwt.JwtEncoder encoder;
    @Autowired SessionService sessions;
    @BeforeEach void clear() { jdbc.execute("TRUNCATE users CASCADE"); }
    private MockHttpServletRequestBuilder auth(String path) {
        return post("/api/v1/auth/" + path).header("X-PayFlow-CSRF", "1").header("Origin", "https://localhost");
    }
    private MvcResult login() throws Exception {
        mvc.perform(auth("register").contentType("application/json").content(json.writeValueAsString(Map.of(
                "fullName", "Alice", "email", "alice@example.com", "phone", "+9779812345678", "password", "Alice-password-123"))))
                .andExpect(status().isCreated());
        return mvc.perform(auth("login").contentType("application/json").content("{\"email\":\"alice@example.com\",\"password\":\"Alice-password-123\"}"))
                .andExpect(status().isOk()).andReturn();
    }
    private Cookie refreshCookie(MvcResult result) { return result.getResponse().getCookie("payflow_refresh"); }
    private String access(MvcResult result) throws Exception { return json.readTree(result.getResponse().getContentAsString()).at("/data/accessToken").asText(); }
    @Test void refreshAndLogoutUseHashedCookieAndImmediatelyRevokeAccess() throws Exception {
        var login = login(); var cookie = refreshCookie(login);
        assertThat(cookie.getValue()).hasSize(43);
        assertThat(login.getResponse().getHeader("Set-Cookie")).contains("Secure", "HttpOnly", "SameSite=Strict", "Path=/api/v1/auth").doesNotContain("Domain=");
        assertThat(login.getResponse().getContentAsString()).doesNotContain(cookie.getValue());
        assertThat(jdbc.queryForObject("SELECT token_hash FROM refresh_tokens", String.class)).hasSize(64).isNotEqualTo(cookie.getValue());
        mvc.perform(get("/api/v1/wallet").cookie(cookie)).andExpect(status().isUnauthorized());
        jdbc.update("UPDATE users SET role = 'MERCHANT'");
        var refreshed = mvc.perform(auth("refresh").cookie(cookie)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.role").value("MERCHANT")).andReturn();
        assertThat(refreshCookie(refreshed).getValue()).isEqualTo(cookie.getValue());
        mvc.perform(auth("logout").cookie(cookie)).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        for (var result : java.util.List.of(login, refreshed))
            mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + access(result))).andExpect(status().isUnauthorized());
        mvc.perform(auth("refresh").cookie(cookie)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(cookie().maxAge("payflow_refresh", 0));
        mvc.perform(auth("logout").cookie(cookie)).andExpect(status().isOk());
        mvc.perform(auth("logout")).andExpect(status().isOk());
        mvc.perform(auth("logout").cookie(new Cookie("payflow_refresh", "unknown"))).andExpect(status().isOk());
    }
    @Test void csrfRejectsBeforeMutationsAndSupportsRefererFallback() throws Exception {
        var cookie = refreshCookie(login());
        mvc.perform(post("/api/v1/auth/logout").cookie(cookie).header("Origin", "https://localhost")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/logout").cookie(cookie).header("X-PayFlow-CSRF", "1").header("Origin", "https://evil.example")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/refresh").cookie(cookie).header("X-PayFlow-CSRF", "1")).andExpect(status().isForbidden());
        mvc.perform(auth("login").contentType("application/x-www-form-urlencoded").content("email=alice@example.com")).andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM login_sessions WHERE revoked_at IS NOT NULL", Integer.class)).isZero();
        mvc.perform(post("/api/v1/auth/refresh").cookie(cookie).header("X-PayFlow-CSRF", "1").header("Referer", "https://localhost/app"))
                .andExpect(status().isOk());
    }
    @Test void expiredAndSuspendedSessionsCannotRefreshOrAuthorize() throws Exception {
        var login = login(); var cookie = refreshCookie(login);
        jdbc.update("UPDATE login_sessions SET created_at = now() - interval '8 days', idle_expires_at = now() - interval '1 second'");
        mvc.perform(auth("refresh").cookie(cookie)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + access(login))).andExpect(status().isUnauthorized());
    }
    @Test void absoluteExpiryAndInactiveAccountRejectRefresh() throws Exception {
        var login = login(); var cookie = refreshCookie(login);
        jdbc.update("UPDATE users SET status = 'SUSPENDED'");
        mvc.perform(auth("refresh").cookie(cookie)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + access(login))).andExpect(status().isUnauthorized());
        jdbc.update("UPDATE users SET status = 'ACTIVE'");
        jdbc.update("UPDATE login_sessions SET created_at = now() - interval '8 days', absolute_expires_at = now() - interval '1 second', idle_expires_at = now() - interval '1 second'");
        mvc.perform(auth("refresh").cookie(cookie)).andExpect(status().isUnauthorized());
    }
    @Test void accessExpiryIsCappedAndRefreshOnlyExtendsIdleWithinAbsoluteDeadline() throws Exception {
        var login = login(); var cookie = refreshCookie(login);
        jdbc.update("UPDATE login_sessions SET absolute_expires_at = now() + interval '60 seconds', idle_expires_at = now() + interval '30 seconds'");
        var before = jdbc.queryForMap("SELECT absolute_expires_at, idle_expires_at FROM login_sessions");
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + access(login))).andExpect(status().isOk());
        assertThat(jdbc.queryForMap("SELECT absolute_expires_at, idle_expires_at FROM login_sessions")).isEqualTo(before);
        var refreshed = mvc.perform(auth("refresh").cookie(cookie)).andExpect(status().isOk()).andReturn();
        var after = jdbc.queryForMap("SELECT absolute_expires_at, idle_expires_at FROM login_sessions");
        assertThat(after.get("absolute_expires_at")).isEqualTo(before.get("absolute_expires_at"));
        assertThat(after.get("idle_expires_at")).isEqualTo(after.get("absolute_expires_at"));
        assertThat(decoder.decode(access(refreshed)).getExpiresAt()).isBeforeOrEqualTo(
                ((java.sql.Timestamp) after.get("absolute_expires_at")).toInstant());
        assertThat(refreshCookie(refreshed).getMaxAge()).isBetween(0, 60);
    }
    @Test void jwtRequiresExistingSessionOwnedByItsSubject() throws Exception {
        var login = login(); var jwt = decoder.decode(access(login));
        for (String sid : java.util.List.of("missing", "malformed", java.util.UUID.randomUUID().toString())) {
            var claims = org.springframework.security.oauth2.jwt.JwtClaimsSet.builder().claims(c -> c.putAll(jwt.getClaims()));
            if (sid.equals("missing")) claims.claims(c -> c.remove("sid")); else claims.claim("sid", sid);
            String token = encoder.encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(
                    org.springframework.security.oauth2.jwt.JwsHeader.with(org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build(), claims.build())).getTokenValue();
            mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        }
        mvc.perform(auth("register").contentType("application/json").content(json.writeValueAsString(Map.of(
                "fullName", "Bob", "email", "bob@example.com", "phone", "+9779812345679", "password", "Bob-password-123"))))
                .andExpect(status().isCreated());
        jdbc.update("UPDATE login_sessions SET user_id = (SELECT id FROM users WHERE email = 'bob@example.com')");
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + access(login))).andExpect(status().isUnauthorized());
    }
    @Test void concurrentRefreshAndLogoutNeverReviveSession() throws Exception {
        var cookie = refreshCookie(login());
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var refresh = executor.submit(() -> { start.await(); try { sessions.refresh(cookie.getValue()); }
                catch (org.springframework.security.authentication.BadCredentialsException expected) { } return null; });
            var logout = executor.submit(() -> { start.await(); sessions.logout(cookie.getValue()); return null; });
            start.countDown(); refresh.get(10, java.util.concurrent.TimeUnit.SECONDS); logout.get(10, java.util.concurrent.TimeUnit.SECONDS);
        }
        mvc.perform(auth("refresh").cookie(cookie)).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM login_sessions WHERE revoked_at IS NOT NULL", Integer.class)).isEqualTo(1);
    }
    @Test void missingOrUnknownCookieIsUnauthorized() throws Exception {
        mvc.perform(auth("refresh")).andExpect(status().isUnauthorized()).andExpect(cookie().maxAge("payflow_refresh", 0));
        mvc.perform(auth("refresh").cookie(new Cookie("payflow_refresh", "x".repeat(43)))).andExpect(status().isUnauthorized());
    }
}

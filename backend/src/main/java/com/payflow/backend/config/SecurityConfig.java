package com.payflow.backend.config;

import java.io.IOException;

import com.payflow.backend.auth.security.AccountJwtAuthenticationConverter;
import com.payflow.backend.auth.security.AuthFlowCsrfFilter;
import com.payflow.backend.auth.security.SessionProperties;
import com.payflow.backend.common.response.ApiError;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tools.jackson.databind.ObjectMapper;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final ObjectMapper objectMapper;

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, AccountJwtAuthenticationConverter converter,
            SessionProperties sessionProperties) throws Exception {
        return http
            // Bearer business APIs are exempt; auth flows use the mandatory
            // custom-header/origin defense.
            .csrf(csrf -> csrf.disable())
            .addFilterBefore(new AuthFlowCsrfFilter(sessionProperties, objectMapper),
                    UsernamePasswordAuthenticationFilter.class)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/refresh",
                        "/api/v1/auth/logout")
                .permitAll()
                .requestMatchers(HttpMethod.GET, "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                .permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/auth/me", "/api/v1/wallet", "/api/v1/transactions",
                        "/api/v1/transactions/{id}")
                .hasAnyRole("USER", "MERCHANT", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/v1/wallet/deposit", "/api/v1/transfers")
                .hasAnyRole("USER", "MERCHANT", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/v1/merchants")
                .hasAnyRole("USER", "MERCHANT")
                .requestMatchers(HttpMethod.GET, "/api/v1/merchants/payment-requests", "/api/v1/merchants/payments")
                .hasRole("MERCHANT")
                .requestMatchers(HttpMethod.GET, "/api/v1/merchants/me", "/api/v1/merchants/{id}",
                        "/api/v1/payments/{id}")
                .hasAnyRole("USER", "MERCHANT", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/v1/merchants/payment-requests",
                        "/api/v1/merchants/payment-requests/{id}/cancel", "/api/v1/merchants/payments/{id}/refund")
                .hasRole("MERCHANT")
                .requestMatchers(HttpMethod.POST, "/api/v1/payments/{id}/pay")
                .hasAnyRole("USER", "MERCHANT")
                .requestMatchers(HttpMethod.GET, "/api/v1/admin/accounts", "/api/v1/admin/accounts/{id}",
                        "/api/v1/admin/wallets", "/api/v1/admin/wallets/{id}")
                .hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/v1/admin/accounts/{id}/status",
                        "/api/v1/admin/wallets/{id}/status")
                .hasRole("ADMIN")
                .anyRequest()
                .denyAll())
            .oauth2ResourceServer(resourceServer -> resourceServer.jwt(jwt -> jwt.jwtAuthenticationConverter(converter))
                .authenticationEntryPoint((request, response, exception) -> writeError(response, 401, "UNAUTHORIZED",
                        "Authentication is required."))
                .accessDeniedHandler(
                        (request, response, exception) -> writeError(response, 403, "FORBIDDEN", "Access is denied.")))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, exception) -> writeError(response, 401, "UNAUTHORIZED",
                        "Authentication is required."))
                .accessDeniedHandler(
                        (request, response, exception) -> writeError(response, 403, "FORBIDDEN", "Access is denied.")))
            .build();
    }

    private void writeError(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        if (status == 401) {
            response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        }
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), ApiError.of(code, message));
    }

}

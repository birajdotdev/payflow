package com.payflow.backend.config;

import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

@Configuration
@SecurityScheme(name = "bearerAuth", type = SecuritySchemeType.HTTP, scheme = "bearer", bearerFormat = "JWT")
public class OpenApiConfig {
    @org.springframework.context.annotation.Bean
    org.springdoc.core.customizers.OpenApiCustomizer authenticationFlowDocumentation() {
        return api -> {
            for (String path : java.util.List.of("register", "login", "refresh", "logout")) {
                var item = api.getPaths().get("/api/v1/auth/" + path);
                if (item == null || item.getPost() == null) continue;
                var operation = item.getPost();
                operation.addParametersItem(new io.swagger.v3.oas.models.parameters.Parameter()
                        .in("header").name("X-PayFlow-CSRF").required(true)
                        .description("Mandatory custom-header CSRF marker")
                        .schema(new io.swagger.v3.oas.models.media.StringSchema()._enum(java.util.List.of("1"))).example("1"));
                operation.addParametersItem(new io.swagger.v3.oas.models.parameters.Parameter()
                        .in("header").name("Origin")
                        .description("Exact configured trusted frontend origin; parsed Referer origin accepted when absent")
                        .schema(new io.swagger.v3.oas.models.media.StringSchema()));
                operation.setDescription("Requires X-PayFlow-CSRF: 1 and a trusted Origin (or Referer). "
                        + "JSON is required for registration/login. Responses are Cache-Control: no-store. "
                        + "Login sets and refresh renews the host-only payflow_refresh HttpOnly, Secure, SameSite=Strict cookie "
                        + "at Path=/api/v1/auth. Refresh/logout use this cookie without a bearer token or request body. "
                        + "Refresh returns the login response shape; invalid sessions return 401 and clear the cookie. "
                        + "Logout is idempotent, revokes only the current session, clears the cookie and returns data: null.");
                if (path.equals("refresh") || path.equals("logout")) {
                    operation.addParametersItem(new io.swagger.v3.oas.models.parameters.Parameter()
                            .in("cookie").name("payflow_refresh").required(path.equals("refresh"))
                            .description("Opaque HttpOnly cookie managed by the browser; never a business API credential")
                            .schema(new io.swagger.v3.oas.models.media.StringSchema()));
                }
                operation.getResponses().values().forEach(response -> {
                    response.addHeaderObject("Cache-Control", new io.swagger.v3.oas.models.headers.Header()
                            .schema(new io.swagger.v3.oas.models.media.StringSchema()).description("no-store"));
                    if (!path.equals("register")) response.addHeaderObject("Set-Cookie",
                            new io.swagger.v3.oas.models.headers.Header().schema(new io.swagger.v3.oas.models.media.StringSchema())
                                    .description("Host-only payflow_refresh; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; bounded Max-Age (0 when cleared)"));
                });
                operation.getResponses().addApiResponse("403", new io.swagger.v3.oas.models.responses.ApiResponse()
                        .description("FORBIDDEN: CSRF checks rejected; no session mutation"));
                if (!path.equals("register")) operation.getResponses().addApiResponse("401",
                        new io.swagger.v3.oas.models.responses.ApiResponse().description("Invalid credentials/session"));
            }
        };
    }
}

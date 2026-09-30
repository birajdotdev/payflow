package com.payflow.backend.auth.security;

import com.payflow.backend.common.response.ApiError;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.util.Set;

public class AuthFlowCsrfFilter extends OncePerRequestFilter {
    private static final Set<String> PATHS = Set.of("/api/v1/auth/register", "/api/v1/auth/login",
            "/api/v1/auth/refresh", "/api/v1/auth/logout");
    private final org.springframework.security.web.util.matcher.RequestMatcher authRequests =
            new org.springframework.security.web.util.matcher.OrRequestMatcher(PATHS.stream()
                    .map(path -> (org.springframework.security.web.util.matcher.RequestMatcher)
                            org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher.withDefaults()
                                    .matcher(org.springframework.http.HttpMethod.POST, path)).toList());
    private final SessionProperties properties;
    private final ObjectMapper mapper;
    public AuthFlowCsrfFilter(SessionProperties properties, ObjectMapper mapper) {
        this.properties = properties; this.mapper = mapper;
    }
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (authRequests.matches(request)) {
            String origin = request.getHeader("Origin");
            if (origin == null) origin = refererOrigin(request.getHeader("Referer"));
            boolean jsonRequired = request.getRequestURI().endsWith("/login") || request.getRequestURI().endsWith("/register");
            String type = request.getContentType();
            if (!"1".equals(request.getHeader("X-PayFlow-CSRF")) || origin == null || !properties.trustedOrigins().contains(origin)
                    || (jsonRequired && (type == null || !type.split(";", 2)[0].trim().equalsIgnoreCase("application/json")))) {
                response.setStatus(403); response.setContentType("application/json");
                response.setHeader("Cache-Control", "no-store");
                mapper.writeValue(response.getOutputStream(), ApiError.of("FORBIDDEN", "Authentication CSRF checks failed."));
                return;
            }
        }
        chain.doFilter(request, response);
    }
    private String refererOrigin(String referer) {
        try {
            URI uri = URI.create(referer);
            if (uri.getHost() == null || uri.getRawUserInfo() != null || !Set.of("http", "https").contains(uri.getScheme())) return null;
            return uri.getScheme() + "://" + uri.getHost() + (uri.getPort() < 0 ? "" : ":" + uri.getPort());
        } catch (IllegalArgumentException | NullPointerException e) { return null; }
    }
}

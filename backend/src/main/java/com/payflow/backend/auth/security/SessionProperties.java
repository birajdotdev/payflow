package com.payflow.backend.auth.security;

import java.net.URI;
import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("payflow.session")
public record SessionProperties(Duration absoluteTtl, Duration idleTtl, boolean cookieSecure,
        List<String> trustedOrigins) {
    public SessionProperties {
        if (absoluteTtl == null || idleTtl == null || absoluteTtl.toSeconds() < 1 || idleTtl.toSeconds() < 1
                || absoluteTtl.getNano() != 0 || idleTtl.getNano() != 0)
            throw new IllegalArgumentException("Session lifetimes must be positive whole seconds.");
        if (trustedOrigins == null || trustedOrigins.isEmpty()) {
            throw new IllegalArgumentException("Trusted browser origins must be configured.");
        }
        trustedOrigins = List.copyOf(trustedOrigins);
        for (String origin : trustedOrigins) {
            URI uri = URI.create(origin);
            if (!List.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null
                    || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || !uri.getRawPath().isEmpty() || origin.contains("*"))
                throw new IllegalArgumentException("Trusted origins must be exact HTTP(S) origins.");
            if (!cookieSecure && !List.of("localhost", "127.0.0.1", "[::1]").contains(uri.getHost()))
                throw new IllegalArgumentException(
                        "Insecure cookies are permitted only for local development origins.");
        }
    }
}

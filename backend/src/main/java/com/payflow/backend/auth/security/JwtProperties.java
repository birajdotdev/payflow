package com.payflow.backend.auth.security;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("payflow.jwt")
public record JwtProperties(String secret, String issuer, String audience, Duration accessTokenTtl) {
    public JwtProperties {
        if (issuer == null || issuer.isBlank() || audience == null || audience.isBlank()) {
            throw new IllegalArgumentException("JWT issuer and audience must be configured.");
        }
        if (accessTokenTtl == null || accessTokenTtl.compareTo(Duration.ofSeconds(1)) < 0
                || accessTokenTtl.compareTo(Duration.ofHours(1)) > 0 || accessTokenTtl.getNano() != 0) {
            throw new IllegalArgumentException(
                    "JWT access token TTL must be whole seconds between 1 second and 1 hour.");
        }
    }

    @Override
    public String toString() {
        return "JwtProperties[redacted]";
    }
}

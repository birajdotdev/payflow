package com.payflow.backend.auth.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtConfigTests {
    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"not base64!", "c2hvcnQ="})
    void rejectsMissingMalformedAndShortSigningKeys(String secret) {
        var properties = new JwtProperties(secret, "payflow", "payflow-api", Duration.ofMinutes(15));
        assertThatThrownBy(() -> new JwtConfig().jwtSigningKey(properties))
                .isInstanceOf(IllegalArgumentException.class).hasMessageStartingWith("JWT_SECRET must");
        assertThat(properties.toString()).isEqualTo("JwtProperties[redacted]");
    }

    @Test
    void acceptsA256BitKey() {
        var properties = new JwtProperties(Base64.getEncoder().encodeToString(new byte[32]),
                "payflow", "payflow-api", Duration.ofMinutes(15));
        assertThat(new JwtConfig().jwtSigningKey(properties).getEncoded()).hasSize(32);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PT0S", "PT-1S", "PT2H", "PT1.5S"})
    void rejectsInvalidTokenLifetimes(String ttl) {
        assertThatThrownBy(() -> new JwtProperties("unused", "payflow", "payflow-api", Duration.parse(ttl)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

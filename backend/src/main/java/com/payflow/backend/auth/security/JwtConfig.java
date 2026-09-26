package com.payflow.backend.auth.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(JwtProperties.class)
public class JwtConfig {
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    SecretKey jwtSigningKey(JwtProperties properties) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(properties.secret() == null ? "" : properties.secret());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("JWT_SECRET must be Base64-encoded random key material.");
        }
        if (bytes.length < 32) {
            throw new IllegalArgumentException("JWT_SECRET must contain at least 32 decoded bytes.");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey jwtSigningKey) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(jwtSigningKey));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey jwtSigningKey, JwtProperties properties, Clock clock) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtSigningKey)
                .macAlgorithm(MacAlgorithm.HS256).build();
        JwtTimestampValidator timestamps = new JwtTimestampValidator(Duration.ZERO);
        timestamps.setClock(clock);
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                timestamps,
                new JwtIssuerValidator(properties.issuer()),
                new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                        audience -> audience != null && audience.contains(properties.audience())),
                new JwtClaimValidator<Instant>(JwtClaimNames.EXP, Objects::nonNull),
                new JwtClaimValidator<Instant>(JwtClaimNames.IAT,
                        issuedAt -> issuedAt != null && !issuedAt.isAfter(clock.instant())),
                new JwtClaimValidator<String>(JwtClaimNames.SUB, JwtConfig::isUserId)));
        return decoder;
    }

    private static boolean isUserId(String subject) {
        try {
            return subject != null && UUID.fromString(subject).toString().equals(subject);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}

package com.payflow.backend.auth.security;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import com.payflow.backend.auth.dto.LoginResponse;
import com.payflow.backend.auth.dto.UserProfile;
import com.payflow.backend.auth.entity.LoginSession;
import com.payflow.backend.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AccessTokenIssuer {

    private final JwtEncoder encoder;

    private final JwtProperties properties;

    private final Clock clock;

    public LoginResponse issue(User user, LoginSession session) {
        Instant issuedAt = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant expiresAt = issuedAt.plus(properties.accessTokenTtl());
        if (expiresAt.isAfter(session.expiresAt())) {
            expiresAt = session.expiresAt().truncatedTo(ChronoUnit.SECONDS);
        }
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(properties.issuer())
            .audience(List.of(properties.audience()))
            .subject(user.getId().toString())
            .issuedAt(issuedAt)
            .notBefore(issuedAt)
            .expiresAt(expiresAt)
            .id(UUID.randomUUID().toString())
            .claim("sid", session.getId().toString())
            .claim("role", user.getRole().name())
            .build();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
            .getTokenValue();
        return new LoginResponse(token, "Bearer", expiresAt.getEpochSecond() - issuedAt.getEpochSecond(), expiresAt,
                UserProfile.from(user));
    }

}

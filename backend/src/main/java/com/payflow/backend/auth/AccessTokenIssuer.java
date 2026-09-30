package com.payflow.backend.auth;
import com.payflow.backend.auth.dto.*;
import com.payflow.backend.auth.security.JwtProperties;
import com.payflow.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
@Component
@RequiredArgsConstructor
public class AccessTokenIssuer {
    private final JwtEncoder encoder;
    private final JwtProperties properties;
    private final Clock clock;
    public LoginResponse issue(User user, LoginSession session) {
        Instant issuedAt = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant expiresAt = issuedAt.plus(properties.accessTokenTtl());
        if (expiresAt.isAfter(session.expiresAt())) expiresAt = session.expiresAt().truncatedTo(ChronoUnit.SECONDS);
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
        String token = encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new LoginResponse(token, "Bearer", expiresAt.getEpochSecond() - issuedAt.getEpochSecond(),
                expiresAt, UserProfile.from(user));
    }
}

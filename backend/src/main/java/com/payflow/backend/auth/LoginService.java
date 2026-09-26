package com.payflow.backend.auth;

import com.payflow.backend.auth.dto.LoginRequest;
import com.payflow.backend.auth.dto.LoginResponse;
import com.payflow.backend.auth.dto.UserProfile;
import com.payflow.backend.auth.security.JwtProperties;
import com.payflow.backend.user.User;
import com.payflow.backend.user.UserRepository;
import com.payflow.backend.user.UserStatus;
import jakarta.validation.Valid;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@Validated
public class LoginService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtEncoder encoder;
    private final JwtProperties properties;
    private final Clock clock;
    private final String dummyPasswordHash;

    public LoginService(UserRepository users, PasswordEncoder passwords, JwtEncoder encoder,
                        JwtProperties properties, Clock clock) {
        this.users = users;
        this.passwords = passwords;
        this.encoder = encoder;
        this.properties = properties;
        this.clock = clock;
        this.dummyPasswordHash = passwords.encode(UUID.randomUUID().toString());
    }

    public LoginResponse login(@Valid LoginRequest request) {
        User user = users.findByNormalizedEmail(request.email()).orElse(null);
        // Always perform a BCrypt check, even when the email does not exist.
        boolean matches = passwords.matches(request.password(),
                user == null ? dummyPasswordHash : user.getPasswordHash());
        if (user == null || !matches || user.getStatus() != UserStatus.ACTIVE) {
            throw new BadCredentialsException("Invalid email or password.");
        }
        Instant issuedAt = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant expiresAt = issuedAt.plus(properties.accessTokenTtl());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(properties.issuer())
                .audience(List.of(properties.audience()))
                .subject(user.getId().toString())
                .issuedAt(issuedAt)
                .notBefore(issuedAt)
                .expiresAt(expiresAt)
                .id(UUID.randomUUID().toString())
                .claim("role", user.getRole().name())
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new LoginResponse(token, "Bearer", properties.accessTokenTtl().toSeconds(),
                expiresAt, UserProfile.from(user));
    }
}

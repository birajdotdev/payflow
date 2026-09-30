package com.payflow.backend.auth.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

import com.payflow.backend.auth.dto.LoginResponse;
import com.payflow.backend.auth.entity.LoginSession;
import com.payflow.backend.auth.entity.RefreshToken;
import com.payflow.backend.auth.repository.LoginSessionRepository;
import com.payflow.backend.auth.repository.RefreshTokenRepository;
import com.payflow.backend.auth.security.AccessTokenIssuer;
import com.payflow.backend.auth.security.SessionProperties;
import com.payflow.backend.user.entity.User;
import com.payflow.backend.user.entity.UserStatus;
import com.payflow.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final LoginSessionRepository sessions;

    private final RefreshTokenRepository tokens;

    private final UserRepository users;

    private final SessionProperties properties;

    private final AccessTokenIssuer issuer;

    private final Clock clock;

    private static final SecureRandom RANDOM = new SecureRandom();

    public record Result(LoginResponse response, String refreshToken, Instant expiresAt) {
        @Override
        public String toString() {
            return "SessionResult[redacted]";
        }
    }

    @Transactional
    public Result create(User user) {
        Instant now = clock.instant();
        LoginSession session = sessions.save(new LoginSession(user.getId(), now, now.plus(properties.absoluteTtl()),
                now.plus(properties.idleTtl().compareTo(properties.absoluteTtl()) < 0 ? properties.idleTtl()
                        : properties.absoluteTtl())));
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokens.save(new RefreshToken(hash(token), session.getId()));
        return new Result(issuer.issue(user, session), token, session.expiresAt());
    }

    @Transactional
    public Result refresh(String token) {
        LoginSession session = recognized(token).orElseThrow(SessionService::invalid);
        if (!session.validAt(clock.instant())) {
            throw invalid();
        }
        User user = users.findById(session.getUserId())
            .filter(u -> u.getStatus() == UserStatus.ACTIVE)
            .orElseThrow(SessionService::invalid);
        Instant now = clock.instant();
        if (!session.validAt(now)) {
            throw invalid();
        }
        session.refresh(now.plus(properties.idleTtl()));
        return new Result(issuer.issue(user, session), token, session.expiresAt());
    }

    @Transactional
    public void logout(String token) {
        recognized(token).ifPresent(s -> s.revoke(clock.instant()));
    }

    private Optional<LoginSession> recognized(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) {
            return Optional.empty();
        }
        return tokens.findById(hash(token)).flatMap(t -> sessions.findLocked(t.getSessionId()));
    }

    private static BadCredentialsException invalid() {
        return new BadCredentialsException("Invalid session.");
    }

    private static String hash(String token) {
        try {
            return HexFormat.of()
                .formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII)));
        }
        catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

}

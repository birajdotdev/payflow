package com.payflow.backend.auth.security;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import com.payflow.backend.auth.repository.LoginSessionRepository;
import com.payflow.backend.user.entity.User;
import com.payflow.backend.user.entity.UserStatus;
import com.payflow.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AccountJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UserRepository users;

    private final LoginSessionRepository sessions;

    private final Clock clock;

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        try {
            sessions.findById(UUID.fromString(jwt.getClaimAsString("sid")))
                .filter(s -> s.getUserId().toString().equals(jwt.getSubject()) && s.validAt(clock.instant()))
                .orElseThrow(() -> new IllegalArgumentException("Invalid session"));
        }
        catch (IllegalArgumentException | NullPointerException exception) {
            throw new OAuth2AuthenticationException(new OAuth2Error("invalid_token"));
        }
        User user = users.findById(UUID.fromString(jwt.getSubject()))
            .filter(account -> account.getStatus() == UserStatus.ACTIVE)
            .orElseThrow(() -> new OAuth2AuthenticationException(new OAuth2Error("invalid_token")));
        // Use the current database role, not potentially stale token claims.
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
    }

}

package com.payflow.backend.auth.security;

import com.payflow.backend.user.User;
import com.payflow.backend.user.UserRepository;
import com.payflow.backend.user.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AccountJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {
    private final UserRepository users;

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        User user = users.findById(UUID.fromString(jwt.getSubject()))
                .filter(account -> account.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new OAuth2AuthenticationException(new OAuth2Error("invalid_token")));
        // Use the current database role, not potentially stale token claims.
        return new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
    }
}

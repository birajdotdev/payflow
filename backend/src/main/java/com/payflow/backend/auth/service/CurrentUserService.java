package com.payflow.backend.auth.service;

import java.util.UUID;

import com.payflow.backend.auth.dto.UserProfile;
import com.payflow.backend.user.entity.User;
import com.payflow.backend.user.entity.UserStatus;
import com.payflow.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CurrentUserService {

    private final UserRepository users;

    @Transactional(readOnly = true)
    public User requireCurrentUser() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken token) || !token.isAuthenticated()) {
            throw new AuthenticationCredentialsNotFoundException("Authentication is required.");
        }
        return users.findById(UUID.fromString(token.getToken().getSubject()))
            .filter(user -> user.getStatus() == UserStatus.ACTIVE)
            .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Authentication is required."));
    }

    @Transactional(readOnly = true)
    public UserProfile profile() {
        return UserProfile.from(requireCurrentUser());
    }

}

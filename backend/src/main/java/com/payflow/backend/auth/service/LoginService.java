package com.payflow.backend.auth.service;

import java.util.UUID;

import com.payflow.backend.auth.dto.LoginRequest;
import com.payflow.backend.user.entity.User;
import com.payflow.backend.user.entity.UserStatus;
import com.payflow.backend.user.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class LoginService {

    private final UserRepository users;

    private final PasswordEncoder passwords;

    private final String dummyPasswordHash;

    private final SessionService sessions;

    public LoginService(UserRepository users, PasswordEncoder passwords, SessionService sessions) {
        this.sessions = sessions;
        this.users = users;
        this.passwords = passwords;
        this.dummyPasswordHash = passwords.encode(UUID.randomUUID().toString());
    }

    public SessionService.Result login(@Valid LoginRequest request) {
        User user = users.findByNormalizedEmail(request.email()).orElse(null);
        // Always perform a BCrypt check, even when the email does not exist.
        boolean matches = passwords.matches(request.password(),
                user == null ? dummyPasswordHash : user.getPasswordHash());
        if (user == null || !matches || user.getStatus() != UserStatus.ACTIVE) {
            throw new BadCredentialsException("Invalid email or password.");
        }
        return sessions.create(user);
    }

}

package com.payflow.backend.auth;

import com.payflow.backend.auth.dto.RegisterRequest;
import com.payflow.backend.auth.dto.RegisterResponse;
import com.payflow.backend.user.User;
import com.payflow.backend.user.UserRepository;
import com.payflow.backend.wallet.Wallet;
import com.payflow.backend.wallet.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.Valid;

@Service
@Validated
@RequiredArgsConstructor
public class RegistrationService {
    private final UserRepository users;
    private final WalletRepository wallets;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public RegisterResponse register(@Valid RegisterRequest request) {
        // Database uniqueness is authoritative, including concurrent registrations.
        User user = users.saveAndFlush(new User(request.fullName(), request.email(), request.phone(),
                passwordEncoder.encode(request.password())));
        Wallet wallet = wallets.saveAndFlush(new Wallet(user));
        return new RegisterResponse(user.getId(), user.getFullName(), user.getEmail(), user.getPhone(),
                user.getRole(), wallet.getId());
    }
}

package com.payflow.backend.auth.dto;

import com.payflow.backend.auth.validation.RegistrationPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Locale;

public record LoginRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @RegistrationPassword String password
) {
    public LoginRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    @Override
    public String toString() {
        return "LoginRequest[redacted]";
    }
}

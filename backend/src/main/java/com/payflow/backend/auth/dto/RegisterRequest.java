package com.payflow.backend.auth.dto;

import com.payflow.backend.auth.validation.RegistrationPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Locale;

public record RegisterRequest(
        @NotBlank @Size(max = 100) String fullName,
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Pattern(regexp = "\\+[1-9][0-9]{7,14}") String phone,
        @RegistrationPassword String password
) {
    public RegisterRequest {
        fullName = fullName == null ? null : fullName.strip();
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
        phone = phone == null ? null : phone.strip();
    }

    @Override
    public String toString() {
        return "RegisterRequest[redacted]";
    }
}

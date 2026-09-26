package com.payflow.backend.auth.dto;

import com.payflow.backend.user.UserRole;

import java.util.UUID;

public record RegisterResponse(UUID userId, String fullName, String email, String phone,
                               UserRole role, UUID walletId) {
}

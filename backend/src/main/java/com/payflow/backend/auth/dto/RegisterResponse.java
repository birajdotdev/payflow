package com.payflow.backend.auth.dto;

import java.util.UUID;

import com.payflow.backend.user.entity.UserRole;

public record RegisterResponse(UUID userId, String fullName, String email, String phone, UserRole role, UUID walletId) {
}

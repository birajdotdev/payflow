package com.payflow.backend.admin.dto;

import java.time.Instant;
import java.util.UUID;

import com.payflow.backend.user.entity.User;

public record AccountResponse(UUID accountId, String fullName, String email, String phone, String role, String status,
        UUID walletId, Instant createdAt, Instant updatedAt) {
    public static AccountResponse from(User user, UUID walletId) {
        return new AccountResponse(user.getId(), user.getFullName(), user.getEmail(), user.getPhone(),
                user.getRole().name(), user.getStatus().name(), walletId, user.getCreatedAt(), user.getUpdatedAt());
    }
}

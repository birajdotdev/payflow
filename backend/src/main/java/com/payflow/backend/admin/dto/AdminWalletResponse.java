package com.payflow.backend.admin.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.payflow.backend.wallet.entity.Wallet;

public record AdminWalletResponse(UUID walletId, UUID accountId, String fullName, String email, String accountStatus,
        BigDecimal balance, String currency, String status, Instant createdAt, Instant updatedAt) {
    public static AdminWalletResponse from(Wallet wallet) {
        var user = wallet.getUser();
        return new AdminWalletResponse(wallet.getId(), user.getId(), user.getFullName(), user.getEmail(),
                user.getStatus().name(), wallet.getBalance(), wallet.getCurrency(), wallet.getStatus().name(),
                wallet.getCreatedAt(), wallet.getUpdatedAt());
    }
}

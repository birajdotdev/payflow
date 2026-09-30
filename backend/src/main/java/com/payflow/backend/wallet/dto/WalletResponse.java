package com.payflow.backend.wallet.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.payflow.backend.wallet.entity.Wallet;
import com.payflow.backend.wallet.entity.WalletStatus;

public record WalletResponse(UUID walletId, BigDecimal balance, String currency, WalletStatus status, Instant createdAt,
        Instant updatedAt) {
    public static WalletResponse from(Wallet wallet) {
        return new WalletResponse(wallet.getId(), wallet.getBalance(), wallet.getCurrency(), wallet.getStatus(),
                wallet.getCreatedAt(), wallet.getUpdatedAt());
    }
}

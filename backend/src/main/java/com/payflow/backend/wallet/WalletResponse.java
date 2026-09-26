package com.payflow.backend.wallet;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record WalletResponse(UUID walletId, BigDecimal balance, String currency, WalletStatus status,
                             Instant createdAt, Instant updatedAt) {
    public static WalletResponse from(Wallet wallet) {
        return new WalletResponse(wallet.getId(), wallet.getBalance(), wallet.getCurrency(), wallet.getStatus(),
                wallet.getCreatedAt(), wallet.getUpdatedAt());
    }
}

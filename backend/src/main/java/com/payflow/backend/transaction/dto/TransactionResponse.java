package com.payflow.backend.transaction.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.payflow.backend.transaction.entity.FinancialTransaction;
import com.payflow.backend.transaction.entity.TransactionStatus;
import com.payflow.backend.transaction.entity.TransactionType;

/**
 * Public receipt shared by history and detail endpoints; never exposes idempotency keys.
 */
public record TransactionResponse(UUID transactionId, String reference, TransactionType type, TransactionStatus status,
        UUID senderWalletId, UUID receiverWalletId, BigDecimal amount, String currency, String description,
        Instant createdAt) {
    public static TransactionResponse from(FinancialTransaction transaction) {
        return new TransactionResponse(transaction.getId(), transaction.getReference(), transaction.getType(),
                transaction.getStatus(), transaction.getSenderWalletId(), transaction.getReceiverWalletId(),
                transaction.getAmount(), transaction.getCurrency(), transaction.getDescription(),
                transaction.getCreatedAt());
    }
}

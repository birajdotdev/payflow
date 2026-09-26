package com.payflow.backend.transaction;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Public receipt shared by history and detail endpoints; never exposes idempotency keys. */
public record TransactionResponse(UUID transactionId, String reference, TransactionType type,
                                  TransactionStatus status, UUID senderWalletId, UUID receiverWalletId,
                                  BigDecimal amount, String currency, String description, Instant createdAt) {
    public static TransactionResponse from(FinancialTransaction transaction) {
        return new TransactionResponse(transaction.getId(), transaction.getReference(), transaction.getType(),
                transaction.getStatus(), transaction.getSenderWalletId(), transaction.getReceiverWalletId(),
                transaction.getAmount(), transaction.getCurrency(), transaction.getDescription(), transaction.getCreatedAt());
    }
}

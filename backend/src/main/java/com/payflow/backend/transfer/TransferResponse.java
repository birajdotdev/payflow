package com.payflow.backend.transfer;

import com.payflow.backend.transaction.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TransferResponse(UUID transactionId, String reference, TransactionType type,
                               TransactionStatus status, UUID senderWalletId, UUID receiverWalletId,
                               BigDecimal amount, String currency, String description, Instant createdAt) {
    public static TransferResponse from(FinancialTransaction transaction) {
        return new TransferResponse(transaction.getId(), transaction.getReference(), transaction.getType(),
                transaction.getStatus(), transaction.getSenderWalletId(), transaction.getReceiverWalletId(),
                transaction.getAmount(), transaction.getCurrency(), transaction.getDescription(), transaction.getCreatedAt());
    }
}

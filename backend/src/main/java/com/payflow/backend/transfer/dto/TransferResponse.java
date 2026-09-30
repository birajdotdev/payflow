package com.payflow.backend.transfer.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.payflow.backend.transaction.entity.FinancialTransaction;
import com.payflow.backend.transaction.entity.TransactionStatus;
import com.payflow.backend.transaction.entity.TransactionType;

public record TransferResponse(UUID transactionId, String reference, TransactionType type, TransactionStatus status,
        UUID senderWalletId, UUID receiverWalletId, BigDecimal amount, String currency, String description,
        Instant createdAt) {
    public static TransferResponse from(FinancialTransaction transaction) {
        return new TransferResponse(transaction.getId(), transaction.getReference(), transaction.getType(),
                transaction.getStatus(), transaction.getSenderWalletId(), transaction.getReceiverWalletId(),
                transaction.getAmount(), transaction.getCurrency(), transaction.getDescription(),
                transaction.getCreatedAt());
    }
}

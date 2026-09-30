package com.payflow.backend.wallet.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.payflow.backend.transaction.entity.FinancialTransaction;
import com.payflow.backend.transaction.entity.TransactionStatus;
import com.payflow.backend.transaction.entity.TransactionType;

public record DepositResponse(UUID transactionId, String reference, TransactionType type, TransactionStatus status,
        UUID walletId, BigDecimal amount, String currency, BigDecimal balanceAfter, Instant createdAt) {
    public static DepositResponse from(FinancialTransaction transaction) {
        return new DepositResponse(transaction.getId(), transaction.getReference(), transaction.getType(),
                transaction.getStatus(), transaction.getReceiverWalletId(), transaction.getAmount(),
                transaction.getCurrency(), transaction.getBalanceAfter(), transaction.getCreatedAt());
    }
}

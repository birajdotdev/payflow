package com.payflow.backend.wallet;

import com.payflow.backend.transaction.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record DepositResponse(UUID transactionId, String reference, TransactionType type,
                              TransactionStatus status, UUID walletId, BigDecimal amount,
                              String currency, BigDecimal balanceAfter, Instant createdAt) {
    public static DepositResponse from(FinancialTransaction transaction) {
        return new DepositResponse(transaction.getId(), transaction.getReference(), transaction.getType(),
                transaction.getStatus(), transaction.getReceiverWalletId(), transaction.getAmount(),
                transaction.getCurrency(), transaction.getBalanceAfter(), transaction.getCreatedAt());
    }
}

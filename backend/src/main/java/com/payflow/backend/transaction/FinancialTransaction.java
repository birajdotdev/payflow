package com.payflow.backend.transaction;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "transactions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FinancialTransaction {
    @Id
    private UUID id;
    @Column(nullable = false, unique = true, length = 44, updatable = false)
    private String reference;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private TransactionType type;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private TransactionStatus status;
    @Column(name = "sender_wallet_id", updatable = false)
    private UUID senderWalletId;
    @Column(name = "receiver_wallet_id", updatable = false)
    private UUID receiverWalletId;
    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal amount;
    @Column(nullable = false, length = 3, updatable = false)
    private String currency;
    @Column(length = 255, updatable = false)
    private String description;
    @Column(name = "idempotency_key", length = 128, updatable = false)
    private String idempotencyKey;
    @Column(name = "balance_after", precision = 19, scale = 2, updatable = false)
    private BigDecimal balanceAfter;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false, updatable = false)
    private Instant updatedAt;

    public static FinancialTransaction transfer(UUID sender, UUID receiver, BigDecimal amount,
                                                String description, String key) {
        var transaction = deposit(receiver, amount, key, null);
        transaction.type = TransactionType.TRANSFER;
        transaction.senderWalletId = sender;
        transaction.description = description;
        return transaction;
    }

    public static FinancialTransaction deposit(UUID walletId, BigDecimal amount, String key, BigDecimal balanceAfter) {
        var transaction = new FinancialTransaction();
        transaction.id = UUID.randomUUID();
        // PostgreSQL timestamps retain microseconds; keep the initial and replayed receipt identical.
        transaction.createdAt = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        transaction.updatedAt = transaction.createdAt;
        transaction.reference = "PF-" + transaction.createdAt.atOffset(ZoneOffset.UTC).getYear()
                + "-" + transaction.id;
        transaction.type = TransactionType.DEPOSIT;
        transaction.status = TransactionStatus.SUCCESS;
        transaction.receiverWalletId = walletId;
        transaction.amount = amount;
        transaction.currency = "NPR";
        transaction.idempotencyKey = key;
        transaction.balanceAfter = balanceAfter;
        return transaction;
    }
}

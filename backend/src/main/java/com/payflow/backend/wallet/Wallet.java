package com.payflow.backend.wallet;

import com.payflow.backend.user.User;
import com.payflow.backend.common.exception.FinancialException;
import org.springframework.http.HttpStatus;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "wallets")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "user_id",
            nullable = false,
            unique = true,
            updatable = false
    )
    private User user;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal balance = new BigDecimal("0.00");

    @Column(nullable = false, length = 3)
    private String currency = "NPR";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WalletStatus status = WalletStatus.ACTIVE;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at",  nullable = false)
    private Instant updatedAt;

    public Wallet(User user) {
        this.user = Objects.requireNonNull(user, "Wallet owner is required");
    }

    void creditDeposit(BigDecimal amount) {
        if (status != WalletStatus.ACTIVE) {
            throw new FinancialException(
                    HttpStatus.CONFLICT, "WALLET_FROZEN", "Wallet is frozen.");
        }
        BigDecimal updated = balance.add(amount);
        if (updated.compareTo(DepositService.MAX_BALANCE) > 0) {
            throw new FinancialException(
                    HttpStatus.CONFLICT, "BALANCE_LIMIT_EXCEEDED",
                    "Simulated wallet balance cannot exceed NPR 1000000.00.");
        }
        balance = updated;
    }

    public void transferTo(Wallet receiver, BigDecimal amount) {
        if (id.equals(receiver.id)) {
            throw new FinancialException(HttpStatus.BAD_REQUEST, "SELF_TRANSFER", "Cannot transfer to the same wallet.");
        }
        if (amount == null || amount.signum() <= 0 || amount.scale() > 2) {
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Invalid transfer amount.");
        }
        if (status != WalletStatus.ACTIVE || receiver.status != WalletStatus.ACTIVE) {
            throw new FinancialException(HttpStatus.CONFLICT, "WALLET_FROZEN", "Wallet is frozen.");
        }
        if (balance.compareTo(amount) < 0) {
            throw new FinancialException(HttpStatus.CONFLICT, "INSUFFICIENT_BALANCE", "Insufficient wallet balance.");
        }
        receiver.creditDeposit(amount);
        balance = balance.subtract(amount);
    }

    @PrePersist
    public void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void onUpdate() {
        updatedAt = Instant.now();
    }
}

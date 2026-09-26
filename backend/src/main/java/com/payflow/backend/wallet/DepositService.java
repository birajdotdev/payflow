package com.payflow.backend.wallet;

import com.payflow.backend.auth.CurrentUserService;
import com.payflow.backend.common.exception.FinancialException;
import com.payflow.backend.transaction.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class DepositService {
    public static final BigDecimal MAX_DEPOSIT = new BigDecimal("100000.00");
    public static final BigDecimal MAX_BALANCE = new BigDecimal("1000000.00");
    private final CurrentUserService currentUserService;
    private final WalletRepository wallets;
    private final TransactionRepository transactions;

    @Transactional
    public DepositResponse deposit(BigDecimal amount, String key) {
        var owner = currentUserService.requireCurrentUser();
        if (amount == null || amount.signum() <= 0 || amount.scale() > 2
                || amount.compareTo(MAX_DEPOSIT) > 0) {
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "Deposit amount must be NPR 0.01 to 100000.00 with at most two decimal places.");
        }
        if (key == null || !key.matches("[A-Za-z0-9_-]{1,128}")) {
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "Idempotency-Key must contain 1 to 128 letters, digits, underscores or hyphens.");
        }
        // Lock before reading the key: concurrent requests wait until the first commit/rollback.
        var wallet = wallets.findByUserIdForUpdate(owner.getId())
                .orElseThrow(() -> new IllegalStateException("Primary wallet is missing."));
        var previous = transactions.findByReceiverWalletIdAndTypeAndIdempotencyKey(
                wallet.getId(), TransactionType.DEPOSIT, key);
        if (previous.isPresent()) {
            var transaction = previous.get();
            if (transaction.getAmount().compareTo(amount) != 0) {
                throw new FinancialException(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT",
                        "This idempotency key was already used with a different amount.");
            }
            return DepositResponse.from(transaction);
        }
        wallet.creditDeposit(amount.setScale(2));
        // Flush the balance first so a subsequent record failure exercises real DB rollback.
        wallets.flush();
        var transaction = FinancialTransaction.deposit(wallet.getId(), amount.setScale(2), key, wallet.getBalance());
        transactions.saveAndFlush(transaction);
        return DepositResponse.from(transaction);
    }
}

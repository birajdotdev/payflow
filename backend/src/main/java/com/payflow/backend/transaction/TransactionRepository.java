package com.payflow.backend.transaction;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<FinancialTransaction, UUID> {
    Optional<FinancialTransaction> findBySenderWalletIdAndTypeAndIdempotencyKey(
            UUID walletId, TransactionType type, String idempotencyKey);

    Optional<FinancialTransaction> findByReceiverWalletIdAndTypeAndIdempotencyKey(
            UUID walletId, TransactionType type, String idempotencyKey);
}

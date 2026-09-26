package com.payflow.backend.transaction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<FinancialTransaction, UUID>, JpaSpecificationExecutor<FinancialTransaction> {
    @Query("select t from FinancialTransaction t where t.id = :id "
            + "and (t.senderWalletId = :walletId or t.receiverWalletId = :walletId)")
    Optional<FinancialTransaction> findVisibleById(@Param("id") UUID id, @Param("walletId") UUID walletId);

    Optional<FinancialTransaction> findBySenderWalletIdAndTypeAndIdempotencyKey(
            UUID walletId, TransactionType type, String idempotencyKey);

    Optional<FinancialTransaction> findByReceiverWalletIdAndTypeAndIdempotencyKey(
            UUID walletId, TransactionType type, String idempotencyKey);
}

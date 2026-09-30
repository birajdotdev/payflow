package com.payflow.backend.payment.repository;

import java.util.Optional;
import java.util.UUID;

import com.payflow.backend.payment.entity.PaymentRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface PaymentRequestRepository extends JpaRepository<PaymentRequest, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PaymentRequest p where p.id = :id")
    Optional<PaymentRequest> findByIdForUpdate(@Param("id") UUID id);

    Page<PaymentRequest> findByMerchantId(UUID merchantId, Pageable pageable);

}

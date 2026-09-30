package com.payflow.backend.payment.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "payment_requests")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PaymentRequest {

    @Id
    private UUID id;

    @Column(name = "merchant_id", nullable = false, updatable = false)
    private UUID merchantId;

    @Column(nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal amount;

    @Column(nullable = false, length = 3, updatable = false)
    private String currency;

    @Column(length = 255, updatable = false)
    private String description;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public PaymentRequest(UUID merchantId, BigDecimal amount, String description, Instant expiry) {
        this.id = UUID.randomUUID();
        this.merchantId = merchantId;
        this.amount = amount.setScale(2);
        this.currency = "NPR";
        this.description = description;
        this.status = "PENDING";
        this.createdAt = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        this.updatedAt = createdAt;
        this.expiresAt = expiry.truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    }

    public String effectiveStatus() {
        return status.equals("PENDING") && !expiresAt.isAfter(Instant.now()) ? "EXPIRED" : status;
    }

    public void markPaid() {
        status = "PAID";
        updatedAt = Instant.now();
    }

    public void cancel() {
        status = "CANCELLED";
        updatedAt = Instant.now();
    }

}

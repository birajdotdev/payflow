package com.payflow.backend.payment.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.payflow.backend.merchant.entity.Merchant;
import com.payflow.backend.payment.entity.PaymentRequest;

public record PaymentRequestResponse(UUID paymentRequestId, UUID merchantId, String businessName, BigDecimal amount,

        String currency, String description, String status, Instant expiresAt, Instant createdAt, UUID transactionId) {
    public static PaymentRequestResponse from(PaymentRequest p, Merchant m, UUID transactionId) {
        return new PaymentRequestResponse(p.getId(), m.getId(), m.getBusinessName(), p.getAmount(), p.getCurrency(),
                p.getDescription(), p.effectiveStatus(), p.getExpiresAt(), p.getCreatedAt(), transactionId);
    }
}

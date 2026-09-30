package com.payflow.backend.merchant.dto;

import java.time.Instant;
import java.util.UUID;

import com.payflow.backend.merchant.entity.Merchant;

public record MerchantResponse(UUID merchantId, String businessName, String contactEmail, String contactNumber,

        UUID walletId, String status, Instant createdAt) {
    public static MerchantResponse from(Merchant m) {
        return new MerchantResponse(m.getId(), m.getBusinessName(), m.getContactEmail(), m.getContactNumber(),
                m.getWalletId(), m.getStatus(), m.getCreatedAt());
    }
}

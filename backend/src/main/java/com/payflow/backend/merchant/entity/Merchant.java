package com.payflow.backend.merchant.entity;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "merchants")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Merchant {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true, updatable = false)
    private UUID userId;

    @Column(name = "wallet_id", nullable = false, unique = true, updatable = false)
    private UUID walletId;

    @Column(name = "business_name", nullable = false, length = 100)
    private String businessName;

    @Column(name = "contact_email", nullable = false, length = 255)
    private String contactEmail;

    @Column(name = "contact_number", nullable = false, length = 20)
    private String contactNumber;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Merchant(UUID userId, UUID walletId, String name, String email, String phone) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.walletId = walletId;
        this.businessName = name;
        this.contactEmail = email;
        this.contactNumber = phone;
        this.status = "ACTIVE";
        this.createdAt = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    }

}

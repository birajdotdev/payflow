package com.payflow.backend.auth.entity;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "login_sessions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LoginSession {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "absolute_expires_at", nullable = false)
    private Instant absoluteExpiresAt;

    @Column(name = "idle_expires_at", nullable = false)
    private Instant idleExpiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    public LoginSession(UUID userId, Instant now, Instant absolute, Instant idle) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.createdAt = now;
        this.absoluteExpiresAt = absolute;
        this.idleExpiresAt = idle;
    }

    public Instant expiresAt() {
        return idleExpiresAt.isBefore(absoluteExpiresAt) ? idleExpiresAt : absoluteExpiresAt;
    }

    public boolean validAt(Instant now) {
        return revokedAt == null && now.isBefore(expiresAt());
    }

    public void refresh(Instant deadline) {
        idleExpiresAt = deadline.isBefore(absoluteExpiresAt) ? deadline : absoluteExpiresAt;
    }

    public void revoke(Instant now) {
        if (revokedAt == null) {
            revokedAt = now;
        }
    }

}

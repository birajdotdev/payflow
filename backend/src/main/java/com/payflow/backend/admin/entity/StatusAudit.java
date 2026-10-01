package com.payflow.backend.admin.entity;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "status_audits")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StatusAudit {

    @Id
    private UUID id;

    @Column(nullable = false, updatable = false)
    private UUID actorId;

    @Column(nullable = false, updatable = false)
    private String resourceType;

    @Column(nullable = false, updatable = false)
    private UUID targetId;

    @Column(nullable = false, updatable = false)
    private String previousState;

    @Column(nullable = false, updatable = false)
    private String newState;

    @Column(nullable = false, updatable = false, length = 500)
    private String reason;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public StatusAudit(UUID actor, String resource, UUID target, String previous, String next, String reason) {
        id = UUID.randomUUID();
        actorId = actor;
        resourceType = resource;
        targetId = target;
        previousState = previous;
        newState = next;
        this.reason = reason;
        createdAt = Instant.now();
    }

}

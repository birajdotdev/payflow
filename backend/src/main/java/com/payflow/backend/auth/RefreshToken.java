package com.payflow.backend.auth;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;
@Entity
@Table(name = "refresh_tokens")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {
    @Id @Column(name = "token_hash", length = 64) private String tokenHash;
    @Column(name = "session_id", nullable = false, unique = true) private UUID sessionId;
    public RefreshToken(String hash, UUID sessionId) { this.tokenHash = hash; this.sessionId = sessionId; }
}

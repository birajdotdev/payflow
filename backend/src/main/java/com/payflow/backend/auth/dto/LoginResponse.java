package com.payflow.backend.auth.dto;

import java.time.Instant;

public record LoginResponse(String accessToken, String tokenType, long expiresIn,
                            Instant expiresAt, UserProfile user) {
    @Override
    public String toString() {
        return "LoginResponse[redacted]";
    }
}

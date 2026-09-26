package com.payflow.backend.common.response;

import java.time.Instant;

public record ApiError(boolean success, String code, String message, Instant timestamp) {
    public static ApiError of(String code, String message) {
        return new ApiError(false, code, message, Instant.now());
    }
}

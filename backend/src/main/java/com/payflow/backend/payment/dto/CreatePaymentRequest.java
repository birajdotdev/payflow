package com.payflow.backend.payment.dto;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.validation.constraints.*;

public record CreatePaymentRequest(
        @NotNull @DecimalMin("0.01") @DecimalMax("1000000.00") @Digits(integer = 7, fraction = 2) BigDecimal amount,
        @Size(max = 255) String description, @Future Instant expiresAt) {
}

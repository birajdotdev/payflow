package com.payflow.backend.wallet.dto;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;

public record DepositRequest(@Schema(description = "Simulated NPR amount, at most two decimal places", minimum = "0.01",
        maximum = "100000", example = "1000") BigDecimal amount) {
}

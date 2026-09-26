package com.payflow.backend.wallet;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

public record DepositRequest(
        @Schema(description = "Simulated NPR amount, at most two decimal places", minimum = "0.01", maximum = "100000", example = "1000")
        BigDecimal amount) {
}

package com.payflow.backend.transfer.dto;

import java.math.BigDecimal;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

public record TransferRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID receiverWalletId,
        @Schema(description = "NPR amount with at most two decimal places", minimum = "0.01", maximum = "1000000",
                requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal amount,
        @Schema(maxLength = 255) String description) {
}

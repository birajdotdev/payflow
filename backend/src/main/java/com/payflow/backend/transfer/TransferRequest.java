package com.payflow.backend.transfer;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.UUID;

public record TransferRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID receiverWalletId,
        @Schema(description = "NPR amount with at most two decimal places", minimum = "0.01",
                maximum = "1000000", requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal amount,
        @Schema(maxLength = 255) String description) {
}

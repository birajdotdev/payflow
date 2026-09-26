package com.payflow.backend.transaction;

import com.payflow.backend.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/transactions")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class TransactionController {
    private final TransactionService transactions;

    @GetMapping
    @Operation(summary = "List your wallet transactions, newest first")
    public ApiResponse<TransactionPage> history(
            @RequestParam(required = false) TransactionType type,
            @RequestParam(required = false) TransactionStatus status,
            @Parameter(description = "Inclusive ISO-8601 timestamp with timezone, e.g. 2026-09-01T00:00:00Z")
            @RequestParam(required = false) Instant fromDate,
            @Parameter(description = "Exclusive ISO-8601 timestamp with timezone, e.g. 2026-10-01T00:00:00Z")
            @RequestParam(required = false) Instant toDate,
            @Parameter(description = "Zero-based page number") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size, 1 to 100") @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.of(transactions.history(type, status, fromDate, toDate, page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a receipt for a transaction involving your wallet")
    public ApiResponse<TransactionResponse> detail(@PathVariable UUID id) {
        return ApiResponse.of(transactions.detail(id));
    }
}

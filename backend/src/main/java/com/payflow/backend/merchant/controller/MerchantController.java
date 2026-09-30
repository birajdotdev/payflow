package com.payflow.backend.merchant.controller;

import java.util.UUID;

import com.payflow.backend.common.exception.FinancialException;
import com.payflow.backend.common.response.ApiResponse;
import com.payflow.backend.merchant.dto.*;
import com.payflow.backend.merchant.service.MerchantService;
import com.payflow.backend.payment.dto.*;
import com.payflow.backend.payment.service.PaymentService;
import com.payflow.backend.transaction.dto.TransactionPage;
import com.payflow.backend.transaction.dto.TransactionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/merchants")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class MerchantController {

    private final MerchantService merchants;

    private final PaymentService payments;

    @PostMapping
    @Operation(summary = "Enroll your own account as a demo merchant; repeat identical enrollment safely")
    public ApiResponse<MerchantResponse> create(@Valid @RequestBody CreateMerchantRequest request) {
        return ApiResponse.of(merchants.create(request));
    }

    @GetMapping("/me")
    public ApiResponse<MerchantResponse> me() {
        return ApiResponse.of(merchants.me());
    }

    @GetMapping("/{id}")
    public ApiResponse<MerchantResponse> profile(@PathVariable UUID id) {
        return ApiResponse.of(merchants.profile(id));
    }

    @PostMapping("/payment-requests")
    public ApiResponse<PaymentRequestResponse> createRequest(@Valid @RequestBody CreatePaymentRequest request) {
        return ApiResponse.of(payments.create(request));
    }

    @GetMapping("/payment-requests")
    public ApiResponse<PaymentRequestPage> requests(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.of(payments.list(page, size));
    }

    @PostMapping("/payment-requests/{id}/cancel")
    public ApiResponse<PaymentRequestResponse> cancel(@PathVariable UUID id) {
        return ApiResponse.of(payments.cancel(id));
    }

    @PostMapping("/payments/{id}/refund")
    public ApiResponse<TransactionResponse> refund(@PathVariable UUID id,
            @RequestHeader(name = "Idempotency-Key", required = false) String key,
            @RequestBody(required = false) String body) {
        if (body != null && !body.isBlank())
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "Refunds do not accept an amount or recipient body.");

        return ApiResponse.of(payments.refund(id, key));
    }

    @GetMapping("/payments")
    public ApiResponse<TransactionPage> payments(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.of(merchants.payments(page, size));
    }

}

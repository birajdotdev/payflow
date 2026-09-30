package com.payflow.backend.payment.controller;

import java.util.UUID;

import com.payflow.backend.common.response.ApiResponse;
import com.payflow.backend.payment.dto.PaymentRequestResponse;
import com.payflow.backend.payment.service.PaymentService;
import com.payflow.backend.transaction.dto.TransactionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class PaymentController {

    private final PaymentService payments;

    @GetMapping("/{id}")
    public ApiResponse<PaymentRequestResponse> detail(@PathVariable UUID id) {
        return ApiResponse.of(payments.detail(id));
    }

    @PostMapping("/{id}/pay")
    @Operation(summary = "Pay a request exactly once; retry with the same payer-scoped key for the original receipt")
    public ApiResponse<TransactionResponse> pay(@PathVariable UUID id, @RequestHeader("Idempotency-Key") String key) {
        return ApiResponse.of(payments.pay(id, key));
    }

}

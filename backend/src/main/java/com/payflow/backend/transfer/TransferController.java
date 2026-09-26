package com.payflow.backend.transfer;

import com.payflow.backend.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/transfers")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class TransferController {
    private final TransferService transfers;

    @PostMapping
    @Operation(summary = "Transfer NPR to another wallet; retries return the original receipt")
    public ApiResponse<TransferResponse> transfer(@RequestBody TransferRequest request,
                                                @RequestHeader("Idempotency-Key") String key) {
        return ApiResponse.of(transfers.transfer(request, key));
    }
}

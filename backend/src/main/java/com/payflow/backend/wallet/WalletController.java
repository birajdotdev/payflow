package com.payflow.backend.wallet;

import com.payflow.backend.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/wallet")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class WalletController {
    private final WalletService walletService;
    private final DepositService depositService;

    @PostMapping("/deposit")
    @Operation(summary = "Add simulated NPR funds; retries return the original receipt")
    public ApiResponse<DepositResponse> deposit(@RequestBody DepositRequest request,
            @RequestHeader("Idempotency-Key") String key) {
        return ApiResponse.of(depositService.deposit(request.amount(), key));
    }


    @GetMapping
    public ApiResponse<WalletResponse> wallet() {
        return ApiResponse.of(walletService.currentWallet());
    }
}

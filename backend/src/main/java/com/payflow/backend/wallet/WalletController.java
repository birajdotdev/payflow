package com.payflow.backend.wallet;

import com.payflow.backend.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/wallet")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class WalletController {
    private final WalletService walletService;

    @GetMapping
    public ApiResponse<WalletResponse> wallet() {
        return ApiResponse.of(walletService.currentWallet());
    }
}

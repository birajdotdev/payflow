package com.payflow.backend.admin.controller;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.payflow.backend.admin.dto.*;
import com.payflow.backend.admin.service.AdminService;
import com.payflow.backend.common.exception.FinancialException;
import com.payflow.backend.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService admin;

    @GetMapping("/accounts")
    public ApiResponse<?> accounts(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.of(admin.accounts(page, size));
    }

    @GetMapping("/wallets")
    public ApiResponse<?> wallets(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.of(admin.wallets(page, size));
    }

    @GetMapping("/accounts/{id}")
    public ApiResponse<?> account(@PathVariable UUID id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.of(admin.account(id, page, size));
    }

    @GetMapping("/wallets/{id}")
    public ApiResponse<?> wallet(@PathVariable UUID id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.of(admin.wallet(id, page, size));
    }

    @PutMapping("/accounts/{id}/status")
    public ApiResponse<?> accountStatus(@PathVariable UUID id, @RequestBody Map<String, Object> input) {
        return ApiResponse.of(admin.accountStatus(id, status(input)));
    }

    @PutMapping("/wallets/{id}/status")
    public ApiResponse<?> walletStatus(@PathVariable UUID id, @RequestBody Map<String, Object> input) {
        return ApiResponse.of(admin.walletStatus(id, status(input)));
    }

    private StatusRequest status(Map<String, Object> input) {
        if (!input.keySet().equals(Set.of("status", "reason")) || !(input.get("status") instanceof String state)
                || !(input.get("reason") instanceof String reason))
            throw new FinancialException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "Only status and reason are accepted.");
        return new StatusRequest(state, reason);
    }

}

package com.payflow.backend.auth;

import com.payflow.backend.auth.dto.LoginRequest;
import com.payflow.backend.auth.dto.LoginResponse;
import com.payflow.backend.auth.dto.UserProfile;
import com.payflow.backend.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final LoginService loginService;
    private final CurrentUserService currentUserService;

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.of(loginService.login(request));
    }

    @GetMapping("/me")
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<UserProfile> me() {
        return ApiResponse.of(currentUserService.profile());
    }
}

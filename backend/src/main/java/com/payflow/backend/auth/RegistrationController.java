package com.payflow.backend.auth;

import com.payflow.backend.auth.dto.RegisterRequest;
import com.payflow.backend.auth.dto.RegisterResponse;
import com.payflow.backend.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class RegistrationController {
    private final RegistrationService registrationService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.of(registrationService.register(request));
    }
}

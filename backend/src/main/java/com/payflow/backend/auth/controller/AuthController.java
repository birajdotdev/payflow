package com.payflow.backend.auth.controller;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import com.payflow.backend.auth.dto.LoginRequest;
import com.payflow.backend.auth.dto.LoginResponse;
import com.payflow.backend.auth.dto.UserProfile;
import com.payflow.backend.auth.security.SessionProperties;
import com.payflow.backend.auth.service.CurrentUserService;
import com.payflow.backend.auth.service.LoginService;
import com.payflow.backend.auth.service.SessionService;
import com.payflow.backend.common.response.ApiError;
import com.payflow.backend.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final LoginService loginService;

    private final CurrentUserService currentUserService;

    private final SessionService sessions;

    private final SessionProperties properties;

    private final Clock clock;

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        var result = loginService.login(request);
        cookie(response, result.refreshToken(), result.expiresAt());
        return ApiResponse.of(result.response());
    }

    @PostMapping("/refresh")
    public ApiResponse<LoginResponse> refresh(@CookieValue(name = "payflow_refresh", required = false) String token,
            HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        try {
            var result = sessions.refresh(token);
            cookie(response, result.refreshToken(), result.expiresAt());
            return ApiResponse.of(result.response());
        }
        catch (BadCredentialsException exception) {
            cookie(response, "", clock.instant());
            throw new SessionRejectedException();
        }
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@CookieValue(name = "payflow_refresh", required = false) String token,
            HttpServletResponse response) {
        sessions.logout(token);
        cookie(response, "", clock.instant());
        return ApiResponse.of(null);
    }

    private void cookie(HttpServletResponse response, String token, Instant expiresAt) {
        response.setHeader("Cache-Control", "no-store");
        response.addHeader("Set-Cookie",
                ResponseCookie.from("payflow_refresh", token)
                    .httpOnly(true)
                    .secure(properties.cookieSecure())
                    .sameSite("Strict")
                    .path("/api/v1/auth")
                    .maxAge(Math.max(0, Duration.between(clock.instant(), expiresAt).toSeconds()))
                    .build()
                    .toString());
    }

    @ExceptionHandler(SessionRejectedException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiError rejectedSession() {
        return ApiError.of("UNAUTHORIZED", "Authentication is required.");
    }

    private static class SessionRejectedException extends RuntimeException {

    }

    @GetMapping("/me")
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<UserProfile> me() {
        return ApiResponse.of(currentUserService.profile());
    }

}

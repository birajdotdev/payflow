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
    private final SessionService sessions;
    private final com.payflow.backend.auth.security.SessionProperties properties;
    private final java.time.Clock clock;

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request, jakarta.servlet.http.HttpServletResponse response) {
        var result = loginService.login(request);
        cookie(response, result.refreshToken(), result.expiresAt());
        return ApiResponse.of(result.response());
    }

    @PostMapping("/refresh")
    public ApiResponse<LoginResponse> refresh(@CookieValue(name = "payflow_refresh", required = false) String token,
                                             jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        try {
            var result = sessions.refresh(token);
            cookie(response, result.refreshToken(), result.expiresAt());
            return ApiResponse.of(result.response());
        } catch (org.springframework.security.authentication.BadCredentialsException exception) {
            cookie(response, "", clock.instant());
            throw new SessionRejectedException();
        }
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@CookieValue(name = "payflow_refresh", required = false) String token,
                                   jakarta.servlet.http.HttpServletResponse response) {
        sessions.logout(token);
        cookie(response, "", clock.instant());
        return ApiResponse.of(null);
    }

    private void cookie(jakarta.servlet.http.HttpServletResponse response, String token, java.time.Instant expiresAt) {
        response.setHeader("Cache-Control", "no-store");
        response.addHeader("Set-Cookie", org.springframework.http.ResponseCookie.from("payflow_refresh", token)
                .httpOnly(true).secure(properties.cookieSecure()).sameSite("Strict").path("/api/v1/auth")
                .maxAge(Math.max(0, java.time.Duration.between(clock.instant(), expiresAt).toSeconds())).build().toString());
    }

    @ExceptionHandler(SessionRejectedException.class)
    @ResponseStatus(org.springframework.http.HttpStatus.UNAUTHORIZED)
    public com.payflow.backend.common.response.ApiError rejectedSession() {
        return com.payflow.backend.common.response.ApiError.of("UNAUTHORIZED", "Authentication is required.");
    }
    private static class SessionRejectedException extends RuntimeException {}

    @GetMapping("/me")
    @SecurityRequirement(name = "bearerAuth")
    public ApiResponse<UserProfile> me() {
        return ApiResponse.of(currentUserService.profile());
    }
}

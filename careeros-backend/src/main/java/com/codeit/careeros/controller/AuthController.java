package com.codeit.careeros.controller;

import com.codeit.careeros.common.ApiResponse;
import com.codeit.careeros.dto.auth.AuthResponse;
import com.codeit.careeros.dto.auth.ConsentAcceptRequest;
import com.codeit.careeros.dto.auth.ConsentStatusResponse;
import com.codeit.careeros.dto.auth.GoogleLoginRequest;
import com.codeit.careeros.dto.auth.LoginRequest;
import com.codeit.careeros.dto.auth.RefreshRequest;
import com.codeit.careeros.dto.auth.RegisterRequest;
import com.codeit.careeros.dto.auth.UserResponse;
import com.codeit.careeros.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Tag(name = "Authentication", description = "Register, login, refresh and logout endpoints")
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Value("${app.google.client-id:}")
    private String googleClientId;

    @Operation(summary = "Register a new student account")
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.success("Registration successful", authService.register(request));
    }

    @Operation(summary = "Login with email and password")
    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success("Login successful", authService.login(request));
    }

    @Operation(summary = "Sign in or sign up with a Google ID token (Google Identity Services)")
    @PostMapping("/google")
    public ApiResponse<AuthResponse> google(@Valid @RequestBody GoogleLoginRequest request) {
        return ApiResponse.success("Google sign-in successful",
                authService.googleLogin(request.idToken(), request.termsAccepted()));
    }

    @Operation(summary = "Refresh access token using a refresh token")
    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.success("Token refreshed", authService.refresh(request));
    }

    @Operation(summary = "Logout and revoke the refresh token")
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody(required = false) RefreshRequest request) {
        if (request != null && request.refreshToken() != null) {
            authService.logout(request.refreshToken());
        }
        // An Authorization Bearer access token alone cannot revoke a session
        // (sessions are keyed by refresh-token hash), so without a refresh
        // token logout is a successful no-op. The frontend always sends it.
        return ApiResponse.success("Logged out successfully", null);
    }

    @Operation(summary = "Get the currently authenticated user")
    @GetMapping("/me")
    public ApiResponse<UserResponse> me() {
        return ApiResponse.success(authService.me());
    }

    @Operation(summary = "Consent status of the authenticated caller",
            description = "Returns only the caller's own durable consent evidence. "
                    + "consentCurrent=false means the current policy version has not "
                    + "been explicitly accepted; callers must not assume consent.")
    @GetMapping("/consent")
    public ApiResponse<ConsentStatusResponse> consentStatus() {
        return ApiResponse.success(authService.consentStatus());
    }

    @Operation(summary = "Accept the currently published Terms/Privacy version",
            description = "Authenticated. Requires an explicit termsAccepted=true. "
                    + "Idempotent: repeating the same request returns the original record.")
    @PostMapping("/consent")
    public ApiResponse<ConsentStatusResponse> acceptConsent(
            @RequestBody ConsentAcceptRequest request) {
        return ApiResponse.success("Consent recorded",
                authService.acceptConsent(request.termsAccepted()));
    }

    @Operation(summary = "Public auth configuration (Google Client ID for the sign-in button)",
            description = "Public, unauthenticated. Returns the Google OAuth client ID so the "
                    + "frontend can render the Google button even when the build-time "
                    + "NEXT_PUBLIC_GOOGLE_CLIENT_ID was empty. The client ID is public by design.")
    @GetMapping("/config")
    public ApiResponse<Map<String, Object>> config() {
        String trimmed = googleClientId == null ? "" : googleClientId.trim();
        return ApiResponse.success(Map.of(
                "googleClientId", trimmed,
                "googleConfigured", !trimmed.isEmpty()));
    }
}
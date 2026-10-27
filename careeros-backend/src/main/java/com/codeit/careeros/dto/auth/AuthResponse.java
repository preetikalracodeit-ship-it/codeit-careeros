package com.codeit.careeros.dto.auth;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        UserResponse user,
        // True when the account has no durable consent evidence for the
        // currently published policy version. Authentication still succeeds
        // (legacy accounts must not be locked out), but clients must ask the
        // user to accept before showing that consent is complete.
        boolean consentRequired,
        String consentPolicyVersion
) {
}
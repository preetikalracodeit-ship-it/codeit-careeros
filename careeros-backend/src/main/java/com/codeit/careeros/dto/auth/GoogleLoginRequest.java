package com.codeit.careeros.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record GoogleLoginRequest(
        @NotBlank(message = "Google ID token is required")
        String idToken,

        // Required only when this Google identity creates a new CareerOS
        // account; existing users are never forced to re-consent on login.
        Boolean termsAccepted
) {
}

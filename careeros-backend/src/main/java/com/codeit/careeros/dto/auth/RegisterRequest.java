package com.codeit.careeros.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import com.codeit.careeros.validation.StrongPassword;

public record RegisterRequest(
        @NotBlank(message = "Full name is required")
        @Size(max = 120, message = "Full name must be at most 120 characters")
        String fullName,

        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        @Size(max = 190, message = "Email must be at most 190 characters")
        String email,

        @NotBlank(message = "Mobile number is required")
        @Pattern(regexp = "^[6-9][0-9]{9}$", message = "Mobile must be a 10-digit number starting with 6, 7, 8 or 9")
        String mobile,

        @NotBlank(message = "Password is required")
        @StrongPassword
        String password,

        // Must be explicitly true for a new account. Existing accounts are
        // unaffected because this only applies to registration.
        Boolean termsAccepted
) {
}
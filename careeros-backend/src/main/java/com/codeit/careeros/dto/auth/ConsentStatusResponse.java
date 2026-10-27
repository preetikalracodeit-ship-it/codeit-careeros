package com.codeit.careeros.dto.auth;

import java.time.Instant;

/**
 * The authenticated caller's own consent state. Never exposes another user's
 * evidence and never exposes raw database identifiers.
 */
public record ConsentStatusResponse(
        String currentPolicyVersion,
        boolean consentCurrent,
        String acceptedPolicyVersion,
        Instant acceptedAt,
        String method
) {
}

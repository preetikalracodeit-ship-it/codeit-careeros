package com.codeit.careeros.dto.auth;

/**
 * Re-consent to the currently published Terms/Privacy version. The boolean
 * must be explicitly true; a successful authentication never implies it.
 */
public record ConsentAcceptRequest(Boolean termsAccepted) {
}

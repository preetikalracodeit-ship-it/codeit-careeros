package com.codeit.careeros.common.enums;

/**
 * A kind of consent that is recorded as durable evidence.
 *
 * <p>CareerOS currently asks for one bundled acceptance of the Terms of
 * Service and the Privacy Policy on the sign-up form. It is stored as a
 * single type so the record truthfully reflects the single action the user
 * performed. Do not infer additional consent types from authentication.
 */
public enum ConsentType {
    TERMS_AND_PRIVACY
}

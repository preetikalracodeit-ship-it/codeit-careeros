package com.codeit.careeros.common.enums;

/**
 * How the user reached the consent action. This records the user-facing flow,
 * never an authentication secret or provider token.
 */
public enum ConsentMethod {
    PASSWORD_REGISTRATION,
    GOOGLE_REGISTRATION,
    RECONSENT
}

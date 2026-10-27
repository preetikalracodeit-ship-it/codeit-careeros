package com.codeit.careeros.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Prevents browsers and intermediary caches from storing authentication
 * responses (access/refresh tokens, consent state, account details).
 *
 * <p>CareerOS is a bearer-token API, so this is not a substitute for
 * HttpOnly server-managed sessions. It removes one avoidable token-leak path
 * (shared-machine browser cache / intermediary cache) while the session
 * architecture remains documented in docs/AUTH_SESSION_HARDENING.md.
 */
@Component
public class AuthNoStoreFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (path != null && path.startsWith("/api/v1/auth/")) {
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("Pragma", "no-cache");
        }
        filterChain.doFilter(request, response);
    }
}

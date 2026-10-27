package com.codeit.careeros.security;

import com.codeit.careeros.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Records every platform-admin request that reaches a controller.
 *
 * <p>Pre-controller denials (a STUDENT calling an admin route) are recorded by
 * {@link RestAccessDeniedHandler}. Only method, matched route, status, actor
 * id/role and request id are stored - never query strings, headers, bodies, or
 * student data.
 */
@Component
@RequiredArgsConstructor
public class AdminAuditInterceptor implements HandlerInterceptor {

    private final AuditService auditService;

    @Override
    public void afterCompletion(@NonNull HttpServletRequest request,
                                @NonNull HttpServletResponse response,
                                @NonNull Object handler,
                                Exception ex) {
        String path = request.getRequestURI();
        if (path == null || !path.startsWith("/api/v1/admin/")) {
            return;
        }

        Long actorId = null;
        String actorRole = null;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof CustomUserDetails details) {
            actorId = details.getId();
            actorRole = details.getRole().name();
        }

        Object matched = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String route = matched instanceof String value ? value : path;
        String action = request.getMethod() + " " + route;

        int status = response.getStatus();
        String outcome;
        if (ex != null) {
            outcome = "ERROR";
        } else if (status >= 200 && status < 400) {
            outcome = "SUCCESS";
        } else if (status == HttpServletResponse.SC_FORBIDDEN || status == HttpServletResponse.SC_UNAUTHORIZED) {
            outcome = "DENIED";
        } else {
            outcome = "ERROR";
        }

        auditService.record(actorId, actorRole, action, path, outcome, status,
                MDC.get(RequestIdFilter.MDC_KEY));
    }
}

package com.codeit.careeros.security;

import com.codeit.careeros.common.ApiResponse;
import com.codeit.careeros.exception.ErrorCode;
import com.codeit.careeros.service.AuditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;
    private final AuditService auditService;

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        // Denied admin attempts never reach a controller, so the MVC
        // interceptor cannot see them. Record them here for the audit trail.
        String path = request.getRequestURI();
        if (path != null && path.startsWith("/api/v1/admin/")) {
            Long actorId = null;
            String actorRole = null;
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof CustomUserDetails details) {
                actorId = details.getId();
                actorRole = details.getRole().name();
            }
            auditService.record(actorId, actorRole,
                    request.getMethod() + " " + path, path, "DENIED",
                    HttpServletResponse.SC_FORBIDDEN, MDC.get(RequestIdFilter.MDC_KEY));
        }

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(),
                ApiResponse.error("You do not have permission to perform this action", ErrorCode.FORBIDDEN.name()));
    }
}

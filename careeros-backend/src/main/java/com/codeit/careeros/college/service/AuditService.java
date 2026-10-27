package com.codeit.careeros.college.service;

import com.codeit.careeros.college.enums.AuditOutcome;
import com.codeit.careeros.entity.AuditEvent;
import com.codeit.careeros.repository.AuditEventRepository;
import com.codeit.careeros.security.RequestIdFilter;
import com.codeit.careeros.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Durable institution audit writer. It writes to the same append-only
 * {@code audit_events} table as the platform-admin trail so there is a single
 * audit history.
 *
 * <p>Never pass passwords, tokens, invitation secrets, raw CV text or
 * unnecessary personal data in {@code details}.
 */
@Slf4j
@Service("collegeAuditService")
@RequiredArgsConstructor
public class AuditService {

    private final AuditEventRepository auditEventRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String action,
                       String targetType,
                       String targetId,
                       Long institutionId,
                       CollegeScope scope,
                       AuditOutcome outcome,
                       String details) {
        Long actorId = null;
        String actorEmail = null;
        try {
            var principal = SecurityUtils.currentUser();
            actorId = principal.getId();
            actorEmail = principal.getEmail();
        } catch (RuntimeException ignored) {
            // Public invitation flows have no authenticated actor.
        }
        String trimmedAction = trim(action, 140);
        AuditEvent event = AuditEvent.builder()
                .actorUserId(actorId)
                .actorEmail(actorEmail)
                .action(trimmedAction)
                // The shared table requires a non-null route/path. College
                // actions are recorded as a synthetic path; the real target is
                // kept in target_type/target_id.
                .targetPath(trim("college:" + trimmedAction, 255))
                .targetType(trim(targetType, 60))
                .targetId(trim(targetId, 80))
                .institutionId(institutionId)
                .scopeDescription(scope == null ? null : trim(scope.scopeDescription(), 200))
                .outcome(outcome == null ? AuditOutcome.FAILURE.name() : outcome.name())
                .requestId(trim(MDC.get(RequestIdFilter.MDC_KEY), 64))
                .details(trim(details, 1000))
                .createdAt(java.time.Instant.now())
                .build();
        try {
            auditEventRepository.save(event);
        } catch (RuntimeException ex) {
            // An audit write failure must never expose a secret in logs. The
            // business transaction still fails loudly at the caller when the
            // action is security-critical; this path only logs the action.
            log.error("Could not persist audit event action={} targetType={} outcome={}",
                    action, targetType, outcome, ex);
            throw ex;
        }
    }

    public void success(String action, String targetType, String targetId, Long institutionId,
                        CollegeScope scope, String details) {
        record(action, targetType, targetId, institutionId, scope, AuditOutcome.SUCCESS, details);
    }

    public void denied(String action, String targetType, String targetId, Long institutionId,
                       CollegeScope scope, String details) {
        record(action, targetType, targetId, institutionId, scope, AuditOutcome.DENIED, details);
    }

    public void failure(String action, String targetType, String targetId, Long institutionId,
                        CollegeScope scope, String details) {
        record(action, targetType, targetId, institutionId, scope, AuditOutcome.FAILURE, details);
    }

    private static String trim(String value, int max) {
        if (value == null) {
            return null;
        }
        String cleaned = value.replaceAll("[\\r\\n\\t]+", " ").strip();
        return cleaned.length() <= max ? cleaned : cleaned.substring(0, max);
    }
}

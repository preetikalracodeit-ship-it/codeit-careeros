package com.codeit.careeros.service;

import com.codeit.careeros.entity.AuditEvent;
import com.codeit.careeros.repository.AuditEventRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;

/**
 * Minimum durable audit foundation for privileged actions.
 *
 * <p>Writes use a separate transaction so a rolled-back business transaction
 * still leaves a record of the attempt. The transaction is committed inside the
 * guarded block, so an audit failure is logged and never changes the caller's
 * response; monitoring should alert on the error log. Retention is intentionally
 * NOT enforced here: no approved retention period exists yet (see
 * docs/DATA_RETENTION_AND_DELETION.md).
 */
@Slf4j
@Service
public class AuditService {

    private final AuditEventRepository auditEventRepository;
    private final TransactionTemplate requiresNewTransaction;

    public AuditService(AuditEventRepository auditEventRepository,
                        PlatformTransactionManager transactionManager) {
        this.auditEventRepository = auditEventRepository;
        this.requiresNewTransaction = new TransactionTemplate(transactionManager);
        this.requiresNewTransaction.setPropagationBehavior(
                TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void record(Long actorUserId,
                       String actorRole,
                       String action,
                       String targetPath,
                       String outcome,
                       Integer httpStatus,
                       String requestId) {
        try {
            requiresNewTransaction.executeWithoutResult(status ->
                    auditEventRepository.save(AuditEvent.builder()
                            .actorUserId(actorUserId)
                            .actorRole(actorRole)
                            .action(trim(action, 140))
                            .targetPath(trim(targetPath, 255))
                            .outcome(outcome)
                            .httpStatus(httpStatus)
                            .requestId(trim(requestId, 64))
                            .createdAt(Instant.now())
                            .build()));
        } catch (RuntimeException e) {
            // Never log the request body or credentials here.
            log.error("Failed to persist audit event action={} outcome={} requestId={}",
                    action, outcome, requestId, e);
        }
    }

    private static String trim(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}

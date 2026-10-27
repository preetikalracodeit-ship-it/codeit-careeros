package com.codeit.careeros.repository;

import com.codeit.careeros.entity.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Append-only audit access. There is deliberately no update or delete method:
 * retention/deletion is blocked on an approved policy (see
 * docs/DATA_RETENTION_AND_DELETION.md).
 */
public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

    List<AuditEvent> findAllByOrderByCreatedAtDesc();
}

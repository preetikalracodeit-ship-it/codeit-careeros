package com.codeit.careeros.repository;

import com.codeit.careeros.common.enums.ConsentType;
import com.codeit.careeros.entity.ConsentRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Consent evidence is read-only outside registration/re-consent. No service
 * may update or delete a record; repository mutators are intentionally unused
 * by the application code.
 */
public interface ConsentRecordRepository extends JpaRepository<ConsentRecord, Long> {

    Optional<ConsentRecord> findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(
            Long userId, ConsentType consentType);

    Optional<ConsentRecord> findByUserIdAndConsentTypeAndPolicyVersion(
            Long userId, ConsentType consentType, String policyVersion);

    boolean existsByUserIdAndConsentTypeAndPolicyVersion(
            Long userId, ConsentType consentType, String policyVersion);

    long countByUserId(Long userId);
}

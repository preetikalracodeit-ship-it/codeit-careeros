package com.codeit.careeros.service;

import com.codeit.careeros.common.enums.ConsentMethod;
import com.codeit.careeros.common.enums.ConsentType;
import com.codeit.careeros.dto.auth.ConsentStatusResponse;
import com.codeit.careeros.entity.ConsentRecord;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.repository.ConsentRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Durable, append-only consent evidence.
 *
 * <p>Rules enforced here:
 * <ul>
 *   <li>New accounts must explicitly consent; callers pass the method that
 *       proves which user action was performed.</li>
 *   <li>Successful authentication alone never creates a consent record.</li>
 *   <li>Recording the same user/type/policy version twice is idempotent and
 *       backed by a unique database constraint.</li>
 *   <li>A policy version change creates a new row and leaves history intact.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConsentService {

    private static final ConsentType DEFAULT_TYPE = ConsentType.TERMS_AND_PRIVACY;

    private final ConsentRecordRepository consentRecordRepository;

    @Value("${app.privacy.policy-version:2026-10-26}")
    private String currentPolicyVersion;

    public String currentPolicyVersion() {
        return currentPolicyVersion;
    }

    public boolean isCurrent(User user) {
        return consentRecordRepository.existsByUserIdAndConsentTypeAndPolicyVersion(
                user.getId(), DEFAULT_TYPE, currentPolicyVersion);
    }

    public ConsentStatusResponse status(User user) {
        Optional<ConsentRecord> latest = consentRecordRepository
                .findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(user.getId(), DEFAULT_TYPE);
        return latest
                .map(record -> new ConsentStatusResponse(
                        currentPolicyVersion,
                        currentPolicyVersion.equals(record.getPolicyVersion()),
                        record.getPolicyVersion(),
                        record.getAcceptedAt(),
                        record.getMethod().name()))
                .orElseGet(() -> new ConsentStatusResponse(
                        currentPolicyVersion, false, null, null, null));
    }

    /**
     * Explicit acceptance of the current policy. Must only be called from a
     * flow where the user actually performed a consent action.
     */
    @Transactional
    public ConsentRecord recordCurrentPolicy(User user, ConsentMethod method, String evidence) {
        Optional<ConsentRecord> existing = consentRecordRepository
                .findByUserIdAndConsentTypeAndPolicyVersion(
                        user.getId(), DEFAULT_TYPE, currentPolicyVersion);
        if (existing.isPresent()) {
            // Duplicate/retried submission: return the original evidence
            // instead of creating a second row or changing the timestamp.
            return existing.get();
        }

        ConsentRecord record = ConsentRecord.builder()
                .user(user)
                .consentType(DEFAULT_TYPE)
                .policyVersion(currentPolicyVersion)
                .method(method)
                .evidence(evidence)
                .acceptedAt(Instant.now())
                .build();
        ConsentRecord saved = consentRecordRepository.save(record);
        log.info("Consent recorded userId={} type={} policyVersion={} method={}",
                user.getId(), DEFAULT_TYPE, currentPolicyVersion, method);
        return saved;
    }

    /**
     * Re-consent flow for an already authenticated account. A false/missing
     * flag is rejected; nothing is recorded for an implicit action.
     */
    @Transactional
    public ConsentStatusResponse acceptCurrentPolicy(User user, Boolean accepted) {
        if (!Boolean.TRUE.equals(accepted)) {
            throw BusinessException.badRequest(
                    "You must explicitly accept the Terms of Service and Privacy Policy");
        }
        recordCurrentPolicy(user, ConsentMethod.RECONSENT,
                ConsentRecord.EVIDENCE_AUTHENTICATED_CONSENT);
        return status(user);
    }
}

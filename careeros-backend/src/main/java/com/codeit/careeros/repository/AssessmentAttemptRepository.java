package com.codeit.careeros.repository;

import com.codeit.careeros.assessment.AssessmentAttempt;
import com.codeit.careeros.common.enums.AttemptStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssessmentAttemptRepository extends JpaRepository<AssessmentAttempt, Long> {

    Optional<AssessmentAttempt> findByUserIdAndAssessmentIdAndStatus(
            Long userId, Long assessmentId, AttemptStatus status);

    List<AssessmentAttempt> findByUserIdAndStatusOrderByStartedAtDesc(Long userId, AttemptStatus status);

    Optional<AssessmentAttempt> findFirstByUserIdAndAssessmentIdOrderByStartedAtDesc(Long userId, Long assessmentId);

    long countByStatus(AttemptStatus status);

    boolean existsByUserIdAndStatus(Long userId, AttemptStatus status);

    boolean existsByAssessmentId(Long assessmentId);
}

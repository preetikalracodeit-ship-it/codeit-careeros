package com.codeit.careeros.improvement.repository;

import com.codeit.careeros.improvement.entity.ImprovementPlan;
import com.codeit.careeros.improvement.enums.PlanStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ImprovementPlanRepository extends JpaRepository<ImprovementPlan, Long> {

    Optional<ImprovementPlan> findByIdAndInstitutionId(Long id, Long institutionId);

    List<ImprovementPlan> findByInstitutionIdOrderByUpdatedAtDesc(Long institutionId);

    List<ImprovementPlan> findByStudentProfileIdOrderByUpdatedAtDesc(Long studentProfileId);

    List<ImprovementPlan> findByInstitutionIdAndStatusOrderByUpdatedAtDesc(
            Long institutionId, PlanStatus status);

    long countByInstitutionIdAndStatus(Long institutionId, PlanStatus status);
}

package com.codeit.careeros.placement.repository;

import com.codeit.careeros.placement.entity.JobOpening;
import com.codeit.careeros.placement.enums.JobStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface JobOpeningRepository extends JpaRepository<JobOpening, Long> {

    Optional<JobOpening> findByIdAndInstitutionId(Long id, Long institutionId);

    List<JobOpening> findByInstitutionIdOrderByCreatedAtDesc(Long institutionId);

    List<JobOpening> findByInstitutionIdAndStatusOrderByCreatedAtDesc(Long institutionId, JobStatus status);

    List<JobOpening> findByCompanyIdOrderByCreatedAtDesc(Long companyId);

    long countByInstitutionId(Long institutionId);
}

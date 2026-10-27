package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.AcademicYear;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AcademicYearRepository extends JpaRepository<AcademicYear, Long> {

    List<AcademicYear> findByInstitutionIdOrderByStartDateDesc(Long institutionId);

    Optional<AcademicYear> findByIdAndInstitutionId(Long id, Long institutionId);

    Optional<AcademicYear> findByInstitutionIdAndLabelIgnoreCase(Long institutionId, String label);

    boolean existsByInstitutionIdAndLabelIgnoreCase(Long institutionId, String label);

    Optional<AcademicYear> findFirstByInstitutionIdAndActiveTrue(Long institutionId);
}

package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.Program;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProgramRepository extends JpaRepository<Program, Long> {

    List<Program> findByInstitutionIdOrderByNameAsc(Long institutionId);

    List<Program> findByDepartmentIdOrderByNameAsc(Long departmentId);

    Optional<Program> findByIdAndInstitutionId(Long id, Long institutionId);

    Optional<Program> findByInstitutionIdAndCodeIgnoreCase(Long institutionId, String code);

    boolean existsByInstitutionIdAndCodeIgnoreCase(Long institutionId, String code);
}

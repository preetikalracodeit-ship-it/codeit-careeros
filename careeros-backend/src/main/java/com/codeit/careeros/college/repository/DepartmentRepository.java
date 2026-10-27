package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DepartmentRepository extends JpaRepository<Department, Long> {

    List<Department> findByInstitutionIdOrderByNameAsc(Long institutionId);

    Optional<Department> findByIdAndInstitutionId(Long id, Long institutionId);

    Optional<Department> findByInstitutionIdAndCodeIgnoreCase(Long institutionId, String code);

    boolean existsByInstitutionIdAndCodeIgnoreCase(Long institutionId, String code);
}

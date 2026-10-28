package com.codeit.careeros.placement.repository;

import com.codeit.careeros.placement.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    Optional<Company> findByIdAndInstitutionId(Long id, Long institutionId);

    List<Company> findByInstitutionIdOrderByNameAsc(Long institutionId);

    boolean existsByInstitutionIdAndNameIgnoreCase(Long institutionId, String name);
}

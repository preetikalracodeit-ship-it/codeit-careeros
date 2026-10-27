package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.college.enums.InstitutionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InstitutionRepository extends JpaRepository<Institution, Long> {

    Optional<Institution> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);

    List<Institution> findAllByOrderByNameAsc();

    List<Institution> findByStatusOrderByNameAsc(InstitutionStatus status);
}

package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.Section;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SectionRepository extends JpaRepository<Section, Long> {

    List<Section> findByBatchIdOrderByNameAsc(Long batchId);

    Optional<Section> findByIdAndBatchId(Long id, Long batchId);

    Optional<Section> findByBatchIdAndNameIgnoreCase(Long batchId, String name);

    boolean existsByBatchIdAndNameIgnoreCase(Long batchId, String name);

    List<Section> findByBatchProgramInstitutionIdOrderByNameAsc(Long institutionId);
}

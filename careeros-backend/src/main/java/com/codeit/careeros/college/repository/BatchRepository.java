package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.Batch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BatchRepository extends JpaRepository<Batch, Long> {

    List<Batch> findByProgramIdOrderByLabelAsc(Long programId);

    Optional<Batch> findByIdAndProgramId(Long id, Long programId);

    Optional<Batch> findByProgramIdAndLabelIgnoreCase(Long programId, String label);

    boolean existsByProgramIdAndLabelIgnoreCase(Long programId, String label);

    List<Batch> findByProgramInstitutionIdOrderByLabelAsc(Long institutionId);
}

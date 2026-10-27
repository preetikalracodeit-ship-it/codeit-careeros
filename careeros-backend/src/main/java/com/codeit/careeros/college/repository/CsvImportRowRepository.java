package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.CsvImportRow;
import com.codeit.careeros.college.enums.ImportRowStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CsvImportRowRepository extends JpaRepository<CsvImportRow, Long> {

    List<CsvImportRow> findByJobIdOrderByRowNumberAsc(Long jobId);

    List<CsvImportRow> findByJobIdAndStatusOrderByRowNumberAsc(Long jobId, ImportRowStatus status);

    Optional<CsvImportRow> findByIdAndJobId(Long id, Long jobId);

    long countByJobId(Long jobId);

    long countByJobIdAndStatus(Long jobId, ImportRowStatus status);

    void deleteByJobId(Long jobId);
}

package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.CsvImportJob;
import com.codeit.careeros.college.enums.ImportJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CsvImportJobRepository extends JpaRepository<CsvImportJob, Long> {

    Optional<CsvImportJob> findByIdAndInstitutionId(Long id, Long institutionId);

    Optional<CsvImportJob> findFirstByInstitutionIdAndFileHashAndStatusAndCreatedAtAfterOrderByCreatedAtDesc(
            Long institutionId, String fileHash, ImportJobStatus status, Instant after);

    List<CsvImportJob> findByStatusAndCreatedAtBefore(ImportJobStatus status, Instant before);
}

package com.codeit.careeros.college.dto;

import com.codeit.careeros.college.enums.ImportJobStatus;
import com.codeit.careeros.college.enums.ImportRowStatus;

import java.time.Instant;
import java.util.List;

public final class ImportDtos {

    private ImportDtos() {
    }

    public record ImportRowOutcome(
            int rowNumber,
            ImportRowStatus status,
            String message,
            String rollNumber,
            String email) {
    }

    public record ImportPreviewResponse(
            Long jobId,
            ImportJobStatus status,
            int totalRows,
            int readyRows,
            int skippedRows,
            int rejectedRows,
            List<ImportRowOutcome> rows,
            String errorCsv,
            Instant expiresAt) {
    }

    public record ImportCommitResponse(
            Long jobId,
            ImportJobStatus status,
            int totalRows,
            int createdRows,
            int linkedRows,
            int skippedRows,
            int rejectedRows,
            List<ImportRowOutcome> rows,
            String errorCsv,
            Instant completedAt) {
    }
}

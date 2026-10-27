package com.codeit.careeros.college.entity;

import com.codeit.careeros.college.enums.ImportJobStatus;
import com.codeit.careeros.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "csv_import_jobs",
        indexes = {
                @Index(name = "idx_csv_import_jobs_institution", columnList = "institution_id"),
                @Index(name = "idx_csv_import_jobs_creator", columnList = "created_by"),
                @Index(name = "idx_csv_import_jobs_status", columnList = "status"),
                @Index(name = "idx_csv_import_jobs_hash", columnList = "file_hash")})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CsvImportJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImportJobStatus status;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "file_hash", length = 64)
    private String fileHash;

    @Column(name = "total_rows", nullable = false)
    @Builder.Default
    private int totalRows = 0;

    @Column(name = "created_rows", nullable = false)
    @Builder.Default
    private int createdRows = 0;

    @Column(name = "linked_rows", nullable = false)
    @Builder.Default
    private int linkedRows = 0;

    @Column(name = "skipped_rows", nullable = false)
    @Builder.Default
    private int skippedRows = 0;

    @Column(name = "rejected_rows", nullable = false)
    @Builder.Default
    private int rejectedRows = 0;

    @Column(name = "completed_at")
    private Instant completedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

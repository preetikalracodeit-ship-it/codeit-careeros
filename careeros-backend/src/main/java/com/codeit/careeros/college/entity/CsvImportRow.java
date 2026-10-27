package com.codeit.careeros.college.entity;

import com.codeit.careeros.college.enums.ImportRowStatus;
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

/**
 * Short-lived staging row. Successful and rejected rows are deleted as soon as
 * the commit response is produced so imported PII is not retained indefinitely.
 */
@Entity
@Table(name = "csv_import_rows",
        indexes = @Index(name = "idx_csv_import_rows_job", columnList = "job_id"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CsvImportRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    private CsvImportJob job;

    @Column(name = "row_number", nullable = false)
    private int rowNumber;

    @Column(name = "full_name", length = 120)
    private String fullName;

    @Column(length = 190)
    private String email;

    @Column(length = 20)
    private String mobile;

    @Column(name = "roll_number", length = 40)
    private String rollNumber;

    @Column(name = "department_code", length = 40)
    private String departmentCode;

    @Column(name = "program_code", length = 40)
    private String programCode;

    @Column(name = "batch_label", length = 40)
    private String batchLabel;

    @Column(name = "section_name", length = 40)
    private String sectionName;

    @Column(name = "academic_year_label", length = 40)
    private String academicYearLabel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImportRowStatus status;

    @Column(length = 500)
    private String message;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

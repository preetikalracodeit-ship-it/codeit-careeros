package com.codeit.careeros.placement.entity;

import com.codeit.careeros.college.entity.Batch;
import com.codeit.careeros.college.entity.Department;
import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.college.entity.Program;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.placement.enums.DriveStatus;
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
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "placement_drives",
        indexes = {
                @Index(name = "idx_placement_drives_institution", columnList = "institution_id"),
                @Index(name = "idx_placement_drives_company", columnList = "company_id"),
                @Index(name = "idx_placement_drives_job", columnList = "job_id"),
                @Index(name = "idx_placement_drives_status", columnList = "status")})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlacementDrive {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    private JobOpening job;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(name = "registration_start")
    private LocalDate registrationStart;

    @Column(name = "registration_end")
    private LocalDate registrationEnd;

    @Column(name = "drive_date")
    private LocalDate driveDate;

    @Column(name = "eligibility_criteria", length = 2000)
    private String eligibilityCriteria;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eligible_department_id")
    private Department eligibleDepartment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eligible_program_id")
    private Program eligibleProgram;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eligible_batch_id")
    private Batch eligibleBatch;

    @Column(name = "eligible_graduation_year")
    private Integer eligibleGraduationYear;

    @Column(name = "minimum_readiness_percent")
    private Integer minimumReadinessPercent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private DriveStatus status = DriveStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

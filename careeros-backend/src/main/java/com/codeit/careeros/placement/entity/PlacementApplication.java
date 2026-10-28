package com.codeit.careeros.placement.entity;

import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.placement.enums.ApplicationStage;
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
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "placement_applications",
        uniqueConstraints = @UniqueConstraint(name = "uk_placement_applications_drive_student",
                columnNames = {"drive_id", "student_profile_id"}),
        indexes = {
                @Index(name = "idx_placement_applications_institution", columnList = "institution_id"),
                @Index(name = "idx_placement_applications_drive", columnList = "drive_id"),
                @Index(name = "idx_placement_applications_student", columnList = "student_profile_id"),
                @Index(name = "idx_placement_applications_stage", columnList = "stage")})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlacementApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "drive_id", nullable = false)
    private PlacementDrive drive;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_profile_id", nullable = false)
    private StudentProfile studentProfile;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private ApplicationStage stage = ApplicationStage.REGISTERED;

    @Column(name = "eligibility_override", nullable = false)
    @Builder.Default
    private boolean eligibilityOverride = false;

    @Column(name = "override_reason", length = 500)
    private String overrideReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "override_by")
    private User overrideBy;

    @Column(name = "applied_at", nullable = false)
    private Instant appliedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

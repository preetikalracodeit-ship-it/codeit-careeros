package com.codeit.careeros.improvement.entity;

import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.improvement.enums.PlanStatus;
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

/**
 * A student's evidence-based improvement plan. It is additive to the existing
 * roadmap/projects modules: the plan records the staff decision, owners and
 * target dates, while assessment-derived gaps remain the source evidence.
 */
@Entity
@Table(name = "improvement_plans",
        indexes = {
                @Index(name = "idx_improvement_plans_institution", columnList = "institution_id"),
                @Index(name = "idx_improvement_plans_student", columnList = "student_profile_id"),
                @Index(name = "idx_improvement_plans_status", columnList = "status")})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImprovementPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_profile_id", nullable = false)
    private StudentProfile studentProfile;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 1000)
    private String summary;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private PlanStatus status = PlanStatus.ACTIVE;

    @Column(name = "target_career_name", length = 160)
    private String targetCareerName;

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

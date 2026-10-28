package com.codeit.careeros.improvement.entity;

import com.codeit.careeros.entity.User;
import com.codeit.careeros.improvement.enums.TaskPriority;
import com.codeit.careeros.improvement.enums.TaskStatus;
import com.codeit.careeros.skill.Skill;
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
@Table(name = "improvement_tasks",
        indexes = {
                @Index(name = "idx_improvement_tasks_plan", columnList = "plan_id"),
                @Index(name = "idx_improvement_tasks_status", columnList = "status"),
                @Index(name = "idx_improvement_tasks_target_date", columnList = "target_date")})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImprovementTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private ImprovementPlan plan;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 1000)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "skill_id")
    private Skill skill;

    @Column(name = "skill_name", length = 160)
    private String skillName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TaskPriority priority = TaskPriority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private TaskStatus status = TaskStatus.NOT_STARTED;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private User ownerUser;

    @Column(name = "owner_name", length = 120)
    private String ownerName;

    @Column(name = "baseline_score")
    private Integer baselineScore;

    @Column(name = "target_score")
    private Integer targetScore;

    @Column(name = "evidence_source", length = 60)
    private String evidenceSource;

    @Column(name = "completed_at")
    private Instant completedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

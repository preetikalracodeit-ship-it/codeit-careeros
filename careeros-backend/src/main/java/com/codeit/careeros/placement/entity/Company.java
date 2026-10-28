package com.codeit.careeros.placement.entity;

import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.placement.enums.CompanyStatus;
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
@Table(name = "placement_companies",
        uniqueConstraints = @UniqueConstraint(name = "uk_placement_companies_institution_name",
                columnNames = {"institution_id", "name"}),
        indexes = {
                @Index(name = "idx_placement_companies_institution", columnList = "institution_id"),
                @Index(name = "idx_placement_companies_status", columnList = "recruitment_status")})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(length = 120)
    private String industry;

    @Column(length = 120)
    private String sector;

    @Column(length = 250)
    private String website;

    @Column(name = "contact_name", length = 120)
    private String contactName;

    @Column(name = "contact_email", length = 190)
    private String contactEmail;

    @Column(name = "contact_phone", length = 30)
    private String contactPhone;

    @Enumerated(EnumType.STRING)
    @Column(name = "recruitment_status", nullable = false, length = 20)
    @Builder.Default
    private CompanyStatus recruitmentStatus = CompanyStatus.PROSPECT;

    @Column(length = 120)
    private String source;

    @Column(length = 1000)
    private String notes;

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

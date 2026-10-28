package com.codeit.careeros.placement.entity;

import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.placement.enums.OfferStatus;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "placement_offers",
        uniqueConstraints = @UniqueConstraint(name = "uk_placement_offers_application",
                columnNames = "application_id"),
        indexes = {
                @Index(name = "idx_placement_offers_institution", columnList = "institution_id"),
                @Index(name = "idx_placement_offers_status", columnList = "status")})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlacementOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    private PlacementApplication application;

    @Column(name = "package_amount", precision = 12, scale = 2)
    private BigDecimal packageAmount;

    @Column(length = 10)
    private String currency;

    @Column(name = "offer_date")
    private LocalDate offerDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OfferStatus status = OfferStatus.PENDING;

    @Column(name = "joined_at")
    private LocalDate joinedAt;

    @Column(length = 500)
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

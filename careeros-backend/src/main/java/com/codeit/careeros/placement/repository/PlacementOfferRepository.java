package com.codeit.careeros.placement.repository;

import com.codeit.careeros.placement.entity.PlacementOffer;
import com.codeit.careeros.placement.enums.OfferStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlacementOfferRepository extends JpaRepository<PlacementOffer, Long> {

    Optional<PlacementOffer> findByApplicationId(Long applicationId);

    Optional<PlacementOffer> findByIdAndInstitutionId(Long id, Long institutionId);

    List<PlacementOffer> findByInstitutionIdOrderByCreatedAtDesc(Long institutionId);

    long countByInstitutionId(Long institutionId);

    long countByInstitutionIdAndStatusIn(Long institutionId, List<OfferStatus> statuses);
}

package com.codeit.careeros.placement.repository;

import com.codeit.careeros.placement.entity.PlacementDrive;
import com.codeit.careeros.placement.enums.DriveStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlacementDriveRepository extends JpaRepository<PlacementDrive, Long> {

    Optional<PlacementDrive> findByIdAndInstitutionId(Long id, Long institutionId);

    List<PlacementDrive> findByInstitutionIdOrderByCreatedAtDesc(Long institutionId);

    List<PlacementDrive> findByInstitutionIdAndStatusOrderByCreatedAtDesc(
            Long institutionId, DriveStatus status);

    List<PlacementDrive> findByInstitutionIdAndStatusInOrderByCreatedAtDesc(
            Long institutionId, List<DriveStatus> statuses);

    List<PlacementDrive> findByCompanyIdOrderByCreatedAtDesc(Long companyId);

    long countByInstitutionId(Long institutionId);
}

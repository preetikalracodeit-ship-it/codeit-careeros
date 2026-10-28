package com.codeit.careeros.placement.repository;

import com.codeit.careeros.placement.entity.PlacementApplication;
import com.codeit.careeros.placement.enums.ApplicationStage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlacementApplicationRepository extends JpaRepository<PlacementApplication, Long> {

    Optional<PlacementApplication> findByIdAndInstitutionId(Long id, Long institutionId);

    Optional<PlacementApplication> findByDriveIdAndStudentProfileId(Long driveId, Long studentProfileId);

    List<PlacementApplication> findByDriveIdOrderByAppliedAtAsc(Long driveId);

    List<PlacementApplication> findByStudentProfileIdOrderByAppliedAtDesc(Long studentProfileId);

    List<PlacementApplication> findByInstitutionIdOrderByAppliedAtDesc(Long institutionId);

    long countByDriveId(Long driveId);

    long countByDriveIdAndStage(Long driveId, ApplicationStage stage);

    long countByInstitutionId(Long institutionId);
}

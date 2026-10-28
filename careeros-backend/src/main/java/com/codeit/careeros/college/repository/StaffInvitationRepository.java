package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.StaffInvitation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface StaffInvitationRepository extends JpaRepository<StaffInvitation, Long> {

    Optional<StaffInvitation> findByTokenHash(String tokenHash);

    /**
     * Serialises acceptance of the same token. Two concurrent requests must
     * not both observe an unused invitation and create duplicate memberships.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select invitation from StaffInvitation invitation where invitation.tokenHash = :tokenHash")
    Optional<StaffInvitation> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    Optional<StaffInvitation> findByIdAndInstitutionId(Long id, Long institutionId);

    List<StaffInvitation> findByInstitutionIdOrderByCreatedAtDesc(Long institutionId);

    boolean existsByInstitutionIdAndEmailIgnoreCaseAndAcceptedAtIsNullAndRevokedAtIsNull(
            Long institutionId, String email);

    List<StaffInvitation> findByExpiresAtBeforeAndAcceptedAtIsNullAndRevokedAtIsNull(Instant cutoff);

    long countByAcceptedAtIsNullAndRevokedAtIsNullAndExpiresAtAfter(Instant cutoff);
}

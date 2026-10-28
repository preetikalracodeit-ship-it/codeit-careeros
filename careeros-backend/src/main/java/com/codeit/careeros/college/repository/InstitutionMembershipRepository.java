package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.InstitutionMembership;
import com.codeit.careeros.college.enums.MembershipStatus;
import com.codeit.careeros.college.enums.StaffDesignation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InstitutionMembershipRepository extends JpaRepository<InstitutionMembership, Long> {

    Optional<InstitutionMembership> findByUserIdAndStatus(Long userId, MembershipStatus status);

    Optional<InstitutionMembership> findByUserIdAndInstitutionId(Long userId, Long institutionId);

    List<InstitutionMembership> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<InstitutionMembership> findByInstitutionIdOrderByCreatedAtDesc(Long institutionId);

    Optional<InstitutionMembership> findByIdAndInstitutionId(Long id, Long institutionId);

    boolean existsByUserIdAndStatus(Long userId, MembershipStatus status);

    long countByInstitutionIdAndDesignationAndStatus(
            Long institutionId, StaffDesignation designation, MembershipStatus status);

    long countByInstitutionIdAndStatus(Long institutionId, MembershipStatus status);

    long countByStatus(MembershipStatus status);

    long countByDesignationAndStatus(StaffDesignation designation, MembershipStatus status);
}

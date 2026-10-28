package com.codeit.careeros.admin;

import com.codeit.careeros.college.enums.MembershipStatus;
import com.codeit.careeros.college.enums.StaffDesignation;
import com.codeit.careeros.college.repository.InstitutionMembershipRepository;
import com.codeit.careeros.college.repository.InstitutionRepository;
import com.codeit.careeros.college.repository.StaffInvitationRepository;
import com.codeit.careeros.common.enums.AttemptStatus;
import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.repository.AssessmentAttemptRepository;
import com.codeit.careeros.repository.AssessmentQuestionRepository;
import com.codeit.careeros.repository.AssessmentTestRepository;
import com.codeit.careeros.repository.CareerRepository;
import com.codeit.careeros.repository.SkillRepository;
import com.codeit.careeros.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** High-level counts for the admin dashboard. */
@Service
@RequiredArgsConstructor
public class AdminStatsService {

    private final UserRepository userRepository;
    private final CareerRepository careerRepository;
    private final SkillRepository skillRepository;
    private final AssessmentTestRepository assessmentTestRepository;
    private final AssessmentQuestionRepository questionRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final InstitutionRepository institutionRepository;
    private final InstitutionMembershipRepository membershipRepository;
    private final StaffInvitationRepository invitationRepository;

    @Transactional(readOnly = true)
    public Map<String, Long> stats() {
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("institutions", institutionRepository.count());
        stats.put("collegeStaff", membershipRepository.countByStatus(MembershipStatus.ACTIVE));
        stats.put("collegeAdmins", membershipRepository.countByDesignationAndStatus(
                StaffDesignation.COLLEGE_ADMIN, MembershipStatus.ACTIVE));
        stats.put("pendingInvitations", invitationRepository
                .countByAcceptedAtIsNullAndRevokedAtIsNullAndExpiresAtAfter(Instant.now()));
        stats.put("students", userRepository.countByRole(Role.STUDENT));
        stats.put("careers", careerRepository.count());
        stats.put("skills", skillRepository.count());
        stats.put("assessments", assessmentTestRepository.count());
        stats.put("questions", questionRepository.count());
        stats.put("attempts", attemptRepository.count());
        stats.put("assessmentsCompleted",
                attemptRepository.countByStatus(AttemptStatus.SUBMITTED));
        return stats;
    }
}
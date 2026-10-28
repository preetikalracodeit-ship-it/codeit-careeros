package com.codeit.careeros.college.service;

import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.college.enums.ScopeType;
import com.codeit.careeros.assessment.AssessmentAttempt;
import com.codeit.careeros.common.enums.AttemptStatus;
import com.codeit.careeros.college.repository.StudentEnrollmentRepository;
import com.codeit.careeros.repository.AssessmentAttemptRepository;
import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.service.CareerInsightService;
import com.codeit.careeros.service.CvAnalysisService;
import com.codeit.careeros.service.LinkedInService;
import com.codeit.careeros.service.ProjectService;
import com.codeit.careeros.service.RoadmapService;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Institution-scoped student management and Student 360.
 *
 * <p>Every query starts from an explicit institution predicate and adds the
 * caller's academic scope. A foreign enrollment id is reported as 404 rather
 * than being returned to the caller. Field-level visibility is enforced here,
 * not in the browser.
 */
@Service
@RequiredArgsConstructor
public class StudentService {

    private static final Set<String> SORTABLE = Set.of(
            "fullName", "studentId", "rollNumber", "status", "createdAt");
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_SKILL_GAP_COHORT_SIZE = 5000;

    private final StudentEnrollmentRepository enrollmentRepository;
    private final AcademicScopeService academicScopeService;
    private final CareerInsightService careerInsightService;
    private final RoadmapService roadmapService;
    private final ProjectService projectService;
    private final CvAnalysisService cvAnalysisService;
    private final LinkedInService linkedInService;
    private final AuditService auditService;
    private final AssessmentAttemptRepository assessmentAttemptRepository;

    @Transactional(readOnly = true)
    public StudentDtos.StudentPageResponse list(CollegeScope scope,
                                                StudentDtos.StudentFilter filter,
                                                int page,
                                                int size,
                                                String sortBy,
                                                String sortDir) {
        validateFilters(scope, filter);
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize, sort(sortBy, sortDir));

        Page<StudentEnrollment> result = enrollmentRepository.findAll(
                specification(scope, filter), pageable);

        List<StudentDtos.CollegeStudentListItem> items = result.getContent().stream()
                .map(enrollment -> toListItem(enrollment, scope, filter))
                .toList();
        auditService.success("STUDENT_LIST_READ", "STUDENT_ENROLLMENT", null,
                scope.institutionId(), scope, "rows=" + items.size() + ",total=" + result.getTotalElements());
        return new StudentDtos.StudentPageResponse(
                items,
                result.getTotalElements(),
                result.getNumber(),
                result.getSize(),
                result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public List<StudentEnrollment> allInScope(CollegeScope scope, StudentDtos.StudentFilter filter) {
        validateFilters(scope, filter);
        return enrollmentRepository.findAll(specification(scope, filter));
    }

    @Transactional(readOnly = true)
    public StudentDtos.StudentPageResponse listBelowSkillTarget(CollegeScope scope,
                                                               StudentDtos.StudentFilter filter,
                                                               Long skillId,
                                                               int page,
                                                               int size) {
        if (skillId == null || skillId < 1) {
            throw BusinessException.badRequest("A valid skill id is required");
        }
        List<StudentEnrollment> cohort = allInScope(scope, filter);
        if (cohort.size() > MAX_SKILL_GAP_COHORT_SIZE) {
            throw BusinessException.badRequest("This skill drill-down exceeds 5,000 students; narrow the cohort filters");
        }

        Instant from = filter == null ? null : assessmentBoundary(filter.assessmentDateFrom(), scope.institutionZone());
        Instant toExclusive = filter == null || filter.assessmentDateTo() == null ? null
                : filter.assessmentDateTo().plusDays(1).atStartOfDay(scope.institutionZone()).toInstant();
        List<StudentEnrollment> matching = cohort.stream()
                .filter(enrollment -> enrollment.getStatus() == EnrollmentStatus.ACTIVE)
                .filter(enrollment -> hasSubmittedTargetAttempt(enrollment, from, toExclusive))
                .filter(enrollment -> {
                    ReadinessResponse readiness = careerInsightService.readinessFor(
                            enrollment.getStudentProfile().getUser().getId());
                    return readiness.readinessPercent() != null && readiness.gaps() != null
                            && readiness.gaps().stream().anyMatch(gap -> skillId.equals(gap.skillId())
                            && Boolean.TRUE.equals(gap.assessed())
                            && !Boolean.TRUE.equals(gap.metTarget()));
                })
                .sorted(Comparator.comparing(
                                (StudentEnrollment enrollment) -> enrollment.getStudentProfile().getFullName(),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(enrollment -> enrollment.getStudentProfile().getStudentId()))
                .toList();

        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        long startLong = (long) safePage * safeSize;
        int start = startLong >= matching.size() ? matching.size() : (int) startLong;
        int end = Math.min(start + safeSize, matching.size());
        List<StudentDtos.CollegeStudentListItem> items = matching.subList(start, end).stream()
                .map(enrollment -> toListItem(enrollment, scope, filter))
                .toList();

        auditService.success("SKILL_GAP_STUDENT_DRILLDOWN", "SKILL", String.valueOf(skillId),
                scope.institutionId(), scope, "students=" + matching.size());
        return new StudentDtos.StudentPageResponse(items, matching.size(), safePage, safeSize,
                matching.isEmpty() ? 0 : (matching.size() + safeSize - 1) / safeSize);
    }

    private boolean hasSubmittedTargetAttempt(StudentEnrollment enrollment, Instant from, Instant toExclusive) {
        if (enrollment.getStudentProfile().getTargetCareer() == null) {
            return false;
        }
        Long careerId = enrollment.getStudentProfile().getTargetCareer().getId();
        return assessmentAttemptRepository.findByUserIdAndStatusOrderByStartedAtDesc(
                        enrollment.getStudentProfile().getUser().getId(), AttemptStatus.SUBMITTED).stream()
                .filter(attempt -> attempt.getAssessment() != null
                        && attempt.getAssessment().getCareer() != null
                        && careerId.equals(attempt.getAssessment().getCareer().getId()))
                .map(AssessmentAttempt::getSubmittedAt)
                .filter(java.util.Objects::nonNull)
                .anyMatch(submittedAt -> (from == null || !submittedAt.isBefore(from))
                        && (toExclusive == null || submittedAt.isBefore(toExclusive)));
    }

    @Transactional(readOnly = true)
    public StudentDtos.CollegeStudentDetailResponse detail(CollegeScope scope, Long enrollmentId) {
        StudentEnrollment enrollment = requireEnrollment(scope, enrollmentId);
        StudentProfile profile = enrollment.getStudentProfile();
        Long userId = profile.getUser().getId();
        boolean sensitive = scope.canViewSensitiveProfile();
        boolean cvAllowed = scope.canViewCvAnalysis();

        StudentDtos.CollegeStudentProfileResponse profileResponse =
                new StudentDtos.CollegeStudentProfileResponse(
                        profile.getId(),
                        profile.getStudentId(),
                        profile.getFullName(),
                        sensitive ? profile.getUser().getEmail() : null,
                        sensitive ? profile.getMobile() : null,
                        sensitive ? profile.getDateOfBirth() : null,
                        profile.getCollege(),
                        profile.getDegree(),
                        profile.getBranch(),
                        profile.getGraduationYear(),
                        profile.getSemester(),
                        sensitive ? profile.getLocation() : null,
                        sensitive ? profile.getGithubUrl() : null,
                        sensitive ? profile.getLinkedinUrl() : null,
                        sensitive ? profile.getPortfolioUrl() : null,
                        profile.getTargetCareer() == null ? null : profile.getTargetCareer().getId(),
                        profile.getTargetCareer() == null ? null : profile.getTargetCareer().getName(),
                        profile.getCreatedAt());

        StudentDtos.CollegeStudentDetailResponse response =
                new StudentDtos.CollegeStudentDetailResponse(
                        profileResponse,
                        toEnrollmentResponse(enrollment),
                        careerInsightService.readinessFor(userId),
                        careerInsightService.historyFor(userId, null),
                        roadmapService.roadmapFor(userId),
                        projectService.recommendedFor(userId),
                        cvAllowed ? cvAnalysisService.analyzeFor(userId) : null,
                        cvAllowed ? linkedInService.analyzeFor(userId) : null,
                        new StudentDtos.Student360Permissions(
                                sensitive, cvAllowed, scope.canViewReports(), scope.canExport()),
                        Instant.now());

        auditService.success("STUDENT_VIEW_360", "STUDENT_ENROLLMENT",
                String.valueOf(enrollment.getId()), scope.institutionId(), scope,
                "studentProfileId=" + profile.getId());
        return response;
    }

    @Transactional
    public StudentDtos.EnrollmentStatusResponse updateStatus(CollegeScope scope,
                                                             Long enrollmentId,
                                                             StudentDtos.StudentStatusUpdateRequest request) {
        scope.requireManageStudents();
        if (request == null || request.status() == null) {
            throw BusinessException.badRequest("Enrollment status is required");
        }
        StudentEnrollment enrollment = requireEnrollment(scope, enrollmentId);
        EnrollmentStatus previous = enrollment.getStatus();
        enrollment.setStatus(request.status());
        enrollment = enrollmentRepository.save(enrollment);

        auditService.success("STUDENT_STATUS_UPDATE", "STUDENT_ENROLLMENT",
                String.valueOf(enrollment.getId()), scope.institutionId(), scope,
                "from=" + previous + ",to=" + enrollment.getStatus());
        return new StudentDtos.EnrollmentStatusResponse(
                enrollment.getId(), enrollment.getStatus(), enrollment.getUpdatedAt());
    }

    @Transactional(readOnly = true)
    public StudentEnrollment requireEnrollment(CollegeScope scope, Long enrollmentId) {
        if (enrollmentId == null) {
            throw BusinessException.notFound("Student enrollment not found");
        }
        StudentEnrollment enrollment = enrollmentRepository
                .findByIdAndInstitutionId(enrollmentId, scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Student enrollment not found"));
        if (!inScope(scope, enrollment)) {
            throw BusinessException.notFound("Student enrollment not found");
        }
        return enrollment;
    }

    public StudentDtos.CollegeStudentListItem toListItem(StudentEnrollment enrollment, CollegeScope scope) {
        return toListItem(enrollment, scope, null);
    }

    public StudentDtos.CollegeStudentListItem toListItem(StudentEnrollment enrollment, CollegeScope scope,
                                                          StudentDtos.StudentFilter filter) {
        StudentProfile profile = enrollment.getStudentProfile();
        ReadinessResponse readiness = careerInsightService.readinessFor(profile.getUser().getId());
        boolean sensitive = scope.canViewSensitiveProfile();
        Instant from = filter == null ? null : assessmentBoundary(filter.assessmentDateFrom(), scope.institutionZone());
        Instant toExclusive = filter == null || filter.assessmentDateTo() == null ? null
                : filter.assessmentDateTo().plusDays(1).atStartOfDay(scope.institutionZone()).toInstant();
        boolean assessmentCompleted = from == null && toExclusive == null
                ? assessmentAttemptRepository.existsByUserIdAndStatus(profile.getUser().getId(), AttemptStatus.SUBMITTED)
                : assessmentAttemptRepository.findByUserIdAndStatusOrderByStartedAtDesc(
                                profile.getUser().getId(), AttemptStatus.SUBMITTED).stream()
                        .map(attempt -> attempt.getSubmittedAt())
                        .filter(java.util.Objects::nonNull)
                        .anyMatch(submittedAt -> (from == null || !submittedAt.isBefore(from))
                                && (toExclusive == null || submittedAt.isBefore(toExclusive)));
        return new StudentDtos.CollegeStudentListItem(
                enrollment.getId(),
                profile.getStudentId(),
                profile.getFullName(),
                sensitive ? profile.getUser().getEmail() : null,
                enrollment.getRollNumber(),
                enrollment.getDepartment().getId(),
                enrollment.getDepartment().getName(),
                enrollment.getProgram().getId(),
                enrollment.getProgram().getName(),
                enrollment.getBatch().getId(),
                enrollment.getBatch().getLabel(),
                enrollment.getSection() == null ? null : enrollment.getSection().getId(),
                enrollment.getSection() == null ? null : enrollment.getSection().getName(),
                enrollment.getBatch().getAcademicYear().getLabel(),
                enrollment.getStatus(),
                profile.getTargetCareer() == null ? null : profile.getTargetCareer().getName(),
                Boolean.TRUE.equals(readiness.hasTarget()) ? readiness.readinessPercent() : null,
                assessmentCompleted);
    }

    public StudentDtos.EnrollmentResponse toEnrollmentResponse(StudentEnrollment enrollment) {
        return new StudentDtos.EnrollmentResponse(
                enrollment.getId(),
                enrollment.getInstitution().getId(),
                enrollment.getInstitution().getName(),
                enrollment.getDepartment().getId(),
                enrollment.getDepartment().getName(),
                enrollment.getProgram().getId(),
                enrollment.getProgram().getName(),
                enrollment.getBatch().getId(),
                enrollment.getBatch().getLabel(),
                enrollment.getSection() == null ? null : enrollment.getSection().getId(),
                enrollment.getSection() == null ? null : enrollment.getSection().getName(),
                enrollment.getBatch().getAcademicYear().getId(),
                enrollment.getBatch().getAcademicYear().getLabel(),
                enrollment.getRollNumber(),
                enrollment.getStatus(),
                enrollment.getStartDate(),
                enrollment.getEndDate());
    }

    // ---- scoping / filtering ----

    private Specification<StudentEnrollment> specification(CollegeScope scope,
                                                           StudentDtos.StudentFilter filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("institution").get("id"), scope.institutionId()));

            switch (scope.scopeType()) {
                case INSTITUTION -> {
                    // no additional academic predicate
                }
                case DEPARTMENT -> predicates.add(
                        cb.equal(root.get("department").get("id"), scope.scopeId()));
                case PROGRAM -> predicates.add(
                        cb.equal(root.get("program").get("id"), scope.scopeId()));
                case BATCH -> predicates.add(
                        cb.equal(root.get("batch").get("id"), scope.scopeId()));
                case SECTION -> predicates.add(
                        cb.equal(root.get("section").get("id"), scope.scopeId()));
            }

            if (filter != null) {
                Instant assessmentFrom = assessmentBoundary(filter.assessmentDateFrom(), scope.institutionZone());
                Instant assessmentToExclusive = filter.assessmentDateTo() == null ? null
                        : filter.assessmentDateTo().plusDays(1).atStartOfDay(scope.institutionZone()).toInstant();
                if (filter.status() != null) {
                    predicates.add(cb.equal(root.get("status"), filter.status()));
                }
                if (filter.departmentId() != null) {
                    predicates.add(cb.equal(root.get("department").get("id"), filter.departmentId()));
                }
                if (filter.programId() != null) {
                    predicates.add(cb.equal(root.get("program").get("id"), filter.programId()));
                }
                if (filter.batchId() != null) {
                    predicates.add(cb.equal(root.get("batch").get("id"), filter.batchId()));
                }
                if (filter.sectionId() != null) {
                    predicates.add(cb.equal(root.get("section").get("id"), filter.sectionId()));
                }
                if (filter.academicYearId() != null) {
                    predicates.add(cb.equal(root.get("batch").get("academicYear").get("id"),
                            filter.academicYearId()));
                }
                if (filter.assessmentCompleted() != null || assessmentFrom != null || assessmentToExclusive != null) {
                    Subquery<Long> submittedUserIds = query.subquery(Long.class);
                    Root<AssessmentAttempt> attempt = submittedUserIds.from(AssessmentAttempt.class);
                    List<Predicate> submittedPredicates = new ArrayList<>();
                    submittedPredicates.add(cb.equal(attempt.get("user").get("id"),
                            root.get("studentProfile").get("user").get("id")));
                    submittedPredicates.add(cb.equal(attempt.get("status"), AttemptStatus.SUBMITTED));
                    if (assessmentFrom != null) submittedPredicates.add(cb.greaterThanOrEqualTo(
                            attempt.<Instant>get("submittedAt"), assessmentFrom));
                    if (assessmentToExclusive != null) submittedPredicates.add(cb.lessThan(
                            attempt.<Instant>get("submittedAt"), assessmentToExclusive));
                    submittedUserIds.select(attempt.get("user").get("id")).where(submittedPredicates.toArray(Predicate[]::new));
                    Predicate submitted = cb.exists(submittedUserIds);
                    if (filter.assessmentCompleted() != null) {
                        predicates.add(filter.assessmentCompleted() ? submitted : cb.not(submitted));
                    } else {
                        predicates.add(submitted);
                    }
                }
                if (filter.readinessEvaluated() != null) {
                    Join<Object, Object> profile = root.join("studentProfile", JoinType.INNER);
                    Join<Object, Object> targetCareer = profile.join("targetCareer", JoinType.LEFT);
                    Predicate hasTargetCareer = cb.isNotNull(targetCareer.get("id"));
                    Subquery<Long> submittedForTargetCareer = query.subquery(Long.class);
                    Root<AssessmentAttempt> attempt = submittedForTargetCareer.from(AssessmentAttempt.class);
                    List<Predicate> readinessPredicates = new ArrayList<>();
                    readinessPredicates.add(cb.equal(attempt.get("user").get("id"), profile.get("user").get("id")));
                    readinessPredicates.add(cb.equal(attempt.get("status"), AttemptStatus.SUBMITTED));
                    readinessPredicates.add(cb.equal(attempt.get("assessment").get("career").get("id"), targetCareer.get("id")));
                    if (assessmentFrom != null) readinessPredicates.add(cb.greaterThanOrEqualTo(attempt.<Instant>get("submittedAt"), assessmentFrom));
                    if (assessmentToExclusive != null) readinessPredicates.add(cb.lessThan(attempt.<Instant>get("submittedAt"), assessmentToExclusive));
                    submittedForTargetCareer.select(attempt.get("user").get("id")).where(readinessPredicates.toArray(Predicate[]::new));
                    Predicate evaluated = cb.and(hasTargetCareer, cb.exists(submittedForTargetCareer));
                    predicates.add(filter.readinessEvaluated() ? evaluated : cb.not(evaluated));
                }
                if (filter.search() != null && !filter.search().isBlank()) {
                    String term = "%" + filter.search().trim().toLowerCase(Locale.ROOT) + "%";
                    Join<Object, Object> profile = root.join("studentProfile", JoinType.INNER);
                    Join<Object, Object> user = profile.join("user", JoinType.INNER);
                    List<Predicate> searchPredicates = new ArrayList<>();
                    searchPredicates.add(cb.like(cb.lower(profile.get("fullName")), term));
                    searchPredicates.add(cb.like(cb.lower(profile.get("studentId")), term));
                    searchPredicates.add(cb.like(cb.lower(root.get("rollNumber")), term));
                    // Faculty cannot view the email field, so it must not be
                    // usable as a search oracle either.
                    if (scope.canViewSensitiveProfile()) {
                        searchPredicates.add(cb.like(cb.lower(user.get("email")), term));
                    }
                    predicates.add(cb.or(searchPredicates.toArray(Predicate[]::new)));
                }
            }
            if (query != null) {
                query.distinct(true);
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private void validateFilters(CollegeScope scope, StudentDtos.StudentFilter filter) {
        if (filter == null) {
            return;
        }
        if (filter.assessmentDateFrom() != null && filter.assessmentDateTo() != null
                && filter.assessmentDateFrom().isAfter(filter.assessmentDateTo())) {
            throw BusinessException.badRequest("Assessment submission start date must be on or before end date");
        }
        if (LocalDate.MAX.equals(filter.assessmentDateTo())) {
            throw BusinessException.badRequest("Assessment submission end date is out of range");
        }
        if (filter.departmentId() != null) {
            academicScopeService.requireDepartment(scope.institutionId(), filter.departmentId());
            if (scope.scopeType() == ScopeType.DEPARTMENT
                    && !scope.scopeId().equals(filter.departmentId())) {
                throw BusinessException.notFound("Department not found in this institution");
            }
        }
        if (filter.programId() != null) {
            var program = academicScopeService.requireProgram(scope.institutionId(), filter.programId());
            if (scope.scopeType() == ScopeType.PROGRAM && !scope.scopeId().equals(filter.programId())) {
                throw BusinessException.notFound("Program not found in this institution");
            }
            if (scope.scopeType() == ScopeType.DEPARTMENT
                    && !scope.scopeId().equals(program.getDepartment().getId())) {
                throw BusinessException.notFound("Program not found in this institution");
            }
        }
        if (filter.batchId() != null) {
            var batch = academicScopeService.requireBatch(scope.institutionId(), filter.batchId());
            if (scope.scopeType() == ScopeType.BATCH && !scope.scopeId().equals(filter.batchId())) {
                throw BusinessException.notFound("Batch not found in this institution");
            }
            if (scope.scopeType() == ScopeType.PROGRAM
                    && !scope.scopeId().equals(batch.getProgram().getId())) {
                throw BusinessException.notFound("Batch not found in this institution");
            }
            if (scope.scopeType() == ScopeType.DEPARTMENT
                    && !scope.scopeId().equals(batch.getProgram().getDepartment().getId())) {
                throw BusinessException.notFound("Batch not found in this institution");
            }
        }
        if (filter.sectionId() != null) {
            var section = academicScopeService.requireSection(scope.institutionId(), filter.sectionId());
            if (scope.scopeType() == ScopeType.SECTION && !scope.scopeId().equals(filter.sectionId())) {
                throw BusinessException.notFound("Section not found in this institution");
            }
            if (scope.scopeType() == ScopeType.BATCH
                    && !scope.scopeId().equals(section.getBatch().getId())) {
                throw BusinessException.notFound("Section not found in this institution");
            }
            if (scope.scopeType() == ScopeType.PROGRAM
                    && !scope.scopeId().equals(section.getBatch().getProgram().getId())) {
                throw BusinessException.notFound("Section not found in this institution");
            }
            if (scope.scopeType() == ScopeType.DEPARTMENT
                    && !scope.scopeId().equals(
                            section.getBatch().getProgram().getDepartment().getId())) {
                throw BusinessException.notFound("Section not found in this institution");
            }
        }
        if (filter.academicYearId() != null) {
            academicScopeService.requireAcademicYear(scope.institutionId(), filter.academicYearId());
        }
    }

    private static Instant assessmentBoundary(LocalDate date, ZoneId zone) {
        return date == null ? null : date.atStartOfDay(zone).toInstant();
    }

    private static boolean inScope(CollegeScope scope, StudentEnrollment enrollment) {
        return switch (scope.scopeType()) {
            case INSTITUTION -> true;
            case DEPARTMENT -> enrollment.getDepartment().getId().equals(scope.scopeId());
            case PROGRAM -> enrollment.getProgram().getId().equals(scope.scopeId());
            case BATCH -> enrollment.getBatch().getId().equals(scope.scopeId());
            case SECTION -> enrollment.getSection() != null
                    && enrollment.getSection().getId().equals(scope.scopeId());
        };
    }

    private static Sort sort(String sortBy, String sortDir) {
        String property = sortBy != null && SORTABLE.contains(sortBy) ? sortBy : "fullName";
        String mapped = switch (property) {
            case "fullName" -> "studentProfile.fullName";
            case "studentId" -> "studentProfile.studentId";
            default -> property;
        };
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDir)
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        return Sort.by(direction, mapped);
    }
}

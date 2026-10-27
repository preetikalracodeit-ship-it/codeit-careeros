package com.codeit.careeros.college.service;

import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.college.enums.ScopeType;
import com.codeit.careeros.college.repository.StudentEnrollmentRepository;
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
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
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

    private final StudentEnrollmentRepository enrollmentRepository;
    private final AcademicScopeService academicScopeService;
    private final CareerInsightService careerInsightService;
    private final RoadmapService roadmapService;
    private final ProjectService projectService;
    private final CvAnalysisService cvAnalysisService;
    private final LinkedInService linkedInService;
    private final AuditService auditService;

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
                .map(enrollment -> toListItem(enrollment, scope))
                .toList();
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

        String reason = request.reason() == null ? null
                : request.reason().replaceAll("[\\r\\n\\t]+", " ").strip();
        if (reason != null && reason.length() > 200) {
            reason = reason.substring(0, 200);
        }
        auditService.success("STUDENT_STATUS_UPDATE", "STUDENT_ENROLLMENT",
                String.valueOf(enrollment.getId()), scope.institutionId(), scope,
                "from=" + previous + ",to=" + enrollment.getStatus()
                        + (reason == null || reason.isBlank() ? "" : ",reason=" + reason));
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
        StudentProfile profile = enrollment.getStudentProfile();
        ReadinessResponse readiness = careerInsightService.readinessFor(profile.getUser().getId());
        boolean sensitive = scope.canViewSensitiveProfile();
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
                readiness.submittedAttempts() != null && readiness.submittedAttempts() > 0);
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

package com.codeit.careeros.college.service;

import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.service.CareerInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Phase 1 CSV reports. Every report starts from the same scoped enrollment query. */
@Service
@RequiredArgsConstructor
public class CollegeCsvReportService {

    private static final int MAX_ROWS = 10_000;

    private final StudentService studentService;
    private final CareerInsightService careerInsightService;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public StudentCsvService.CsvExport export(CollegeScope scope,
                                              StudentDtos.StudentFilter filter,
                                              String reportType) {
        scope.requireReports();
        scope.requireExport();
        ReportType type = ReportType.parse(reportType);
        List<StudentEnrollment> enrollments = studentService.allInScope(scope, filter);
        if (enrollments.size() > MAX_ROWS) {
            throw BusinessException.badRequest(
                    "This report exceeds " + MAX_ROWS + " rows; narrow the filters and try again");
        }

        StringBuilder csv = new StringBuilder();
        switch (type) {
            case ROSTER -> roster(csv, enrollments, scope, filter);
            case ASSESSMENT_COMPLETION -> assessmentCompletion(csv, enrollments, scope, filter);
            case READINESS_SUMMARY -> readinessSummary(csv, enrollments, scope, filter);
            case DEPARTMENT_SKILL_GAPS -> departmentSkillGaps(csv, enrollments);
            case BATCH_COVERAGE -> batchCoverage(csv, enrollments, scope, filter);
        }

        byte[] bytes = withBom(csv.toString());
        String filename = "careeros-" + type.fileName + "-" + Instant.now().toEpochMilli() + ".csv";
        auditService.success("STUDENT_REPORT_CSV", "STUDENT_REPORT", type.name(),
                scope.institutionId(), scope, "rows=" + enrollments.size());
        return new StudentCsvService.CsvExport(bytes, filename, enrollments.size());
    }

    private void roster(StringBuilder csv, List<StudentEnrollment> enrollments, CollegeScope scope,
                        StudentDtos.StudentFilter filter) {
        row(csv, Arrays.asList("Student ID", "Roll Number", "Full Name", "Department", "Program", "Batch",
                "Section", "Academic Year", "Enrollment Status", "Target Career", "Readiness %",
                "Assessment Completed"));
        for (StudentEnrollment enrollment : enrollments) {
            var item = studentService.toListItem(enrollment, scope, filter);
            row(csv, Arrays.asList(item.studentId(), item.rollNumber(), item.fullName(), item.departmentName(),
                    item.programName(), item.batchLabel(), item.sectionName(), item.academicYearLabel(),
                    enumValue(item.status()), item.targetCareerName(), percent(item.readinessPercent()),
                    item.assessmentCompleted() ? "Yes" : "No"));
        }
    }

    private void assessmentCompletion(StringBuilder csv, List<StudentEnrollment> enrollments,
                                      CollegeScope scope, StudentDtos.StudentFilter filter) {
        row(csv, Arrays.asList("Student ID", "Roll Number", "Full Name", "Department", "Program", "Batch",
                "Enrollment Status", "Assessment Status"));
        for (StudentEnrollment enrollment : enrollments) {
            var item = studentService.toListItem(enrollment, scope, filter);
            row(csv, Arrays.asList(item.studentId(), item.rollNumber(), item.fullName(), item.departmentName(),
                    item.programName(), item.batchLabel(), enumValue(item.status()),
                    item.assessmentCompleted() ? "ASSESSED" : "NOT_ASSESSED"));
        }
    }

    private void readinessSummary(StringBuilder csv, List<StudentEnrollment> enrollments,
                                  CollegeScope scope, StudentDtos.StudentFilter filter) {
        row(csv, Arrays.asList("Student ID", "Roll Number", "Full Name", "Department", "Program", "Batch",
                "Enrollment Status", "Target Career", "Readiness Status", "Readiness %",
                "Assessed Skills", "Target Skills"));
        for (StudentEnrollment enrollment : enrollments) {
            var item = studentService.toListItem(enrollment, scope, filter);
            ReadinessResponse readiness = careerInsightService.readinessFor(
                    enrollment.getStudentProfile().getUser().getId());
            String status = !Boolean.TRUE.equals(readiness.hasTarget()) ? "NO_TARGET"
                    : readiness.submittedAttempts() == null || readiness.submittedAttempts() == 0
                            ? "NOT_ASSESSED" : "EVALUATED";
            row(csv, Arrays.asList(item.studentId(), item.rollNumber(), item.fullName(), item.departmentName(),
                    item.programName(), item.batchLabel(), enumValue(item.status()),
                    readiness.targetCareerName(), status, percent(readiness.readinessPercent()),
                    number(readiness.assessedSkills()), number(readiness.totalSkills())));
        }
    }

    private void departmentSkillGaps(StringBuilder csv, List<StudentEnrollment> enrollments) {
        Map<SkillKey, SkillAggregate> aggregates = new LinkedHashMap<>();
        for (StudentEnrollment enrollment : enrollments) {
            if (enrollment.getStatus() != EnrollmentStatus.ACTIVE) continue;
            ReadinessResponse readiness = careerInsightService.readinessFor(
                    enrollment.getStudentProfile().getUser().getId());
            if (!Boolean.TRUE.equals(readiness.hasTarget())) continue;
            for (var gap : readiness.gaps()) {
                if (!gap.assessed() || gap.skillId() == null) continue;
                SkillKey key = new SkillKey(enrollment.getDepartment().getId(), gap.skillId());
                SkillAggregate aggregate = aggregates.computeIfAbsent(key,
                        ignored -> new SkillAggregate(enrollment.getDepartment().getName(), gap.skillName()));
                aggregate.assessed.add(enrollment.getId());
                if (!gap.metTarget()) aggregate.belowTarget.add(enrollment.getId());
            }
        }

        row(csv, Arrays.asList("Department", "Skill", "Students Below Target", "Assessed Students", "% Below"));
        aggregates.entrySet().stream().sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    SkillAggregate aggregate = entry.getValue();
                    int assessed = aggregate.assessed.size();
                    int below = aggregate.belowTarget.size();
                    row(csv, Arrays.asList(aggregate.department, aggregate.skill, String.valueOf(below),
                            String.valueOf(assessed), assessed == 0 ? ""
                                    : Math.round(below * 100.0f / assessed) + "%"));
                });
    }

    private void batchCoverage(StringBuilder csv, List<StudentEnrollment> enrollments, CollegeScope scope,
                               StudentDtos.StudentFilter filter) {
        Map<Long, BatchAggregate> aggregates = new LinkedHashMap<>();
        for (StudentEnrollment enrollment : enrollments) {
            var item = studentService.toListItem(enrollment, scope, filter);
            var batch = enrollment.getBatch();
            BatchAggregate aggregate = aggregates.computeIfAbsent(batch.getId(), ignored ->
                    new BatchAggregate(batch.getProgram().getDepartment().getName(),
                            batch.getProgram().getName(), batch.getLabel(), batch.getAcademicYear().getLabel()));
            aggregate.enrolled++;
            if (enrollment.getStatus() == EnrollmentStatus.ACTIVE) {
                aggregate.active++;
                if (item.assessmentCompleted()) aggregate.assessedActive++;
            }
        }

        row(csv, Arrays.asList("Department", "Program", "Batch", "Academic Year", "Enrolled", "Active",
                "Assessed Active", "Not Assessed Active", "Active Coverage %"));
        aggregates.values().forEach(aggregate -> row(csv, Arrays.asList(aggregate.department, aggregate.program,
                aggregate.batch, aggregate.academicYear, String.valueOf(aggregate.enrolled),
                String.valueOf(aggregate.active), String.valueOf(aggregate.assessedActive),
                String.valueOf(aggregate.active - aggregate.assessedActive), aggregate.active == 0 ? ""
                        : Math.round(aggregate.assessedActive * 100.0f / aggregate.active) + "%")));
    }

    private static void row(StringBuilder csv, List<String> cells) {
        for (int index = 0; index < cells.size(); index++) {
            if (index > 0) csv.append(',');
            csv.append(StudentCsvService.escape(cells.get(index)));
        }
        csv.append("\r\n");
    }

    private static byte[] withBom(String value) {
        byte[] body = value.getBytes(StandardCharsets.UTF_8);
        byte[] bytes = new byte[body.length + 3];
        bytes[0] = (byte) 0xEF;
        bytes[1] = (byte) 0xBB;
        bytes[2] = (byte) 0xBF;
        System.arraycopy(body, 0, bytes, 3, body.length);
        return bytes;
    }

    private static String enumValue(Enum<?> value) {
        return value == null ? "" : value.name();
    }

    private static String percent(Integer value) {
        return value == null ? "" : value + "%";
    }

    private static String number(Integer value) {
        return value == null ? "0" : value.toString();
    }

    private enum ReportType {
        ROSTER("student-roster"),
        ASSESSMENT_COMPLETION("assessment-completion"),
        READINESS_SUMMARY("readiness-summary"),
        DEPARTMENT_SKILL_GAPS("department-skill-gaps"),
        BATCH_COVERAGE("batch-assessment-coverage");

        private final String fileName;

        ReportType(String fileName) {
            this.fileName = fileName;
        }

        static ReportType parse(String value) {
            if (value == null) throw BusinessException.badRequest("A report type is required");
            return switch (value.trim().toLowerCase(Locale.ROOT)) {
                case "roster" -> ROSTER;
                case "assessment-completion" -> ASSESSMENT_COMPLETION;
                case "readiness-summary" -> READINESS_SUMMARY;
                case "department-skill-gaps" -> DEPARTMENT_SKILL_GAPS;
                case "batch-assessment-coverage" -> BATCH_COVERAGE;
                default -> throw BusinessException.badRequest("Unsupported report type");
            };
        }
    }

    private record SkillKey(Long departmentId, Long skillId) implements Comparable<SkillKey> {
        @Override
        public int compareTo(SkillKey other) {
            int departmentOrder = departmentId.compareTo(other.departmentId);
            return departmentOrder == 0 ? skillId.compareTo(other.skillId) : departmentOrder;
        }
    }

    private static final class SkillAggregate {
        private final String department;
        private final String skill;
        private final Set<Long> assessed = new HashSet<>();
        private final Set<Long> belowTarget = new HashSet<>();

        private SkillAggregate(String department, String skill) {
            this.department = department;
            this.skill = skill;
        }
    }

    private static final class BatchAggregate {
        private final String department;
        private final String program;
        private final String batch;
        private final String academicYear;
        private int enrolled;
        private int active;
        private int assessedActive;

        private BatchAggregate(String department, String program, String batch, String academicYear) {
            this.department = department;
            this.program = program;
            this.batch = batch;
            this.academicYear = academicYear;
        }
    }
}

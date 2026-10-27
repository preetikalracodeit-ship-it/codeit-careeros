package com.codeit.careeros.college.service;

import com.codeit.careeros.college.dto.DashboardDtos;
import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.dto.insight.SkillGapResponse;
import com.codeit.careeros.exception.BusinessException;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Institution reports. PDFs are generated from the same live dashboard/Student
 * 360 data as the UI; no rows are invented. CV contents are never included —
 * only aggregate CV analysis counts.
 */
@Service
@RequiredArgsConstructor
public class CollegeReportService {

    private final DashboardService dashboardService;
    private final StudentService studentService;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public byte[] cohortPdf(CollegeScope scope, StudentDtos.StudentFilter filter) {
        scope.requireReports();
        DashboardDtos.CollegeDashboardResponse dashboard = dashboardService.dashboard(scope, filter);
        PdfDoc doc = new PdfDoc("Institution Cohort Report", scope.institutionName());

        doc.addSection("Summary");
        doc.addKeyValue("Total enrolled", String.valueOf(dashboard.totalEnrolled()));
        doc.addKeyValue("Active students", String.valueOf(dashboard.activeStudents()));
        doc.addKeyValue("Assessment participants", String.valueOf(dashboard.assessmentParticipants())
                + " (" + (dashboard.assessmentCompletionPercent() == null ? "—"
                : dashboard.assessmentCompletionPercent() + "%") + ")");
        doc.addKeyValue("Readiness evaluated", String.valueOf(dashboard.readinessEvaluated()));
        doc.addKeyValue("Readiness unavailable", String.valueOf(dashboard.readinessUnavailable()));

        doc.addSection("Readiness distribution");
        PdfPTable bands = doc.table(2);
        doc.header(bands, List.of("Band", "Students"));
        for (DashboardDtos.ReadinessBand band : dashboard.readinessDistribution()) {
            doc.row(bands, List.of(band.band(), String.valueOf(band.students())));
        }
        doc.addTable(bands);

        doc.addSection("Common skill gaps");
        if (dashboard.commonGaps().isEmpty()) {
            doc.addBody("No assessed skill gaps are available for the selected cohort.");
        } else {
            PdfPTable gaps = doc.table(4);
            doc.header(gaps, List.of("Skill", "Below target", "Assessed", "% below"));
            for (DashboardDtos.CommonGap gap : dashboard.commonGaps()) {
                doc.row(gaps, List.of(gap.skillName(), String.valueOf(gap.studentsBelowTarget()),
                        String.valueOf(gap.assessedStudents()), gap.percentBelowTarget() + "%"));
            }
            doc.addTable(gaps);
        }

        doc.addSection("Department comparison");
        if (dashboard.departmentComparisons().isEmpty()) {
            doc.addBody("No enrollments match the selected filters.");
        } else {
            PdfPTable departments = doc.table(5);
            doc.header(departments, List.of("Department", "Enrolled", "Active", "Evaluated", "Avg readiness"));
            for (DashboardDtos.DepartmentComparison department : dashboard.departmentComparisons()) {
                doc.row(departments, List.of(
                        department.departmentName(),
                        String.valueOf(department.enrolled()),
                        String.valueOf(department.active()),
                        String.valueOf(department.readinessEvaluated()),
                        department.averageReadinessPercent() == null ? "—"
                                : department.averageReadinessPercent() + "%"));
            }
            doc.addTable(departments);
        }

        doc.addBody("Trend: " + dashboard.trendUnavailableReason());
        byte[] bytes = doc.bytes();
        auditService.success("REPORT_COHORT_PDF", "REPORT", null, scope.institutionId(), scope,
                "students=" + dashboard.totalEnrolled());
        return bytes;
    }

    @Transactional(readOnly = true)
    public byte[] studentPdf(CollegeScope scope, Long enrollmentId) {
        scope.requireReports();
        StudentDtos.CollegeStudentDetailResponse detail = studentService.detail(scope, enrollmentId);
        StudentDtos.CollegeStudentProfileResponse profile = detail.profile();
        PdfDoc doc = new PdfDoc("Student 360 Report", scope.institutionName());

        doc.addSection("Student");
        doc.addKeyValue("Name", profile.fullName());
        doc.addKeyValue("Student ID", profile.studentId());
        doc.addKeyValue("Roll number", detail.enrollment().rollNumber());
        doc.addKeyValue("Program", detail.enrollment().programName());
        doc.addKeyValue("Department", detail.enrollment().departmentName());
        doc.addKeyValue("Batch", detail.enrollment().batchLabel());
        doc.addKeyValue("Academic year", detail.enrollment().academicYearLabel());
        doc.addKeyValue("Enrollment status", detail.enrollment().status().name());

        doc.addSection("Career readiness");
        if (Boolean.TRUE.equals(detail.readiness().hasTarget())) {
            doc.addKeyValue("Target career", detail.readiness().targetCareerName());
            doc.addKeyValue("Readiness", detail.readiness().readinessPercent() + "% ("
                    + pretty(detail.readiness().readinessLevel()) + ")");
            doc.addKeyValue("Assessed skills", detail.readiness().assessedSkills()
                    + " of " + detail.readiness().totalSkills());
            if (!detail.readiness().improvements().isEmpty()) {
                doc.addBody("Priority improvements:");
                for (SkillGapResponse gap : detail.readiness().improvements()) {
                    doc.addBody("• " + gap.skillName() + ": "
                            + (gap.assessed() ? gap.scorePercent() + "%" : "not assessed")
                            + " vs target " + gap.targetPercent() + "%");
                }
            }
        } else {
            doc.addBody("No target career selected; readiness is unavailable.");
        }

        doc.addSection("Learning and projects");
        doc.addBody(detail.roadmap().hasTarget()
                ? detail.roadmap().completedItems() + " of " + detail.roadmap().totalItems()
                        + " roadmap steps completed (" + detail.roadmap().progressPercent() + "%)."
                : "No roadmap available.");
        doc.addBody(detail.projects().totalProjects() + " recommended projects; "
                + detail.projects().completedProjects() + " completed.");

        if (detail.cvAnalysis() != null) {
            doc.addSection("CV analysis (no CV contents included)");
            doc.addBody(detail.cvAnalysis().hasCv()
                    ? detail.cvAnalysis().detectedSkills().size() + " skills detected; "
                            + detail.cvAnalysis().matchedSkills().size() + " framework skills matched; "
                            + detail.cvAnalysis().missingSkills().size() + " missing."
                    : "No CV uploaded.");
        }

        byte[] bytes = doc.bytes();
        auditService.success("REPORT_STUDENT_PDF", "STUDENT_ENROLLMENT",
                String.valueOf(enrollmentId), scope.institutionId(), scope, "student360");
        return bytes;
    }

    public String cohortFilename() {
        return "careeros-cohort-report-" + Instant.now().toEpochMilli() + ".pdf";
    }

    public String studentFilename(Long enrollmentId) {
        return "careeros-student-" + enrollmentId + "-report.pdf";
    }

    private static String pretty(String value) {
        if (value == null || value.isBlank()) {
            return "—";
        }
        String lower = value.toLowerCase(Locale.ROOT).replace('_', ' ');
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private static String formatDate(Instant instant) {
        if (instant == null) {
            return "—";
        }
        return DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm")
                .withZone(ZoneId.systemDefault()).format(instant);
    }

    private static final class PdfDoc {
        private final Document document;
        private final ByteArrayOutputStream out;
        private final Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 19);
        private final Font h1Font = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13);
        private final Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 10);
        private final Font smallFont = FontFactory.getFont(FontFactory.HELVETICA, 9);

        PdfDoc(String title, String institution) {
            try {
                document = new Document(PageSize.A4, 48, 48, 56, 48);
                out = new ByteArrayOutputStream();
                PdfWriter.getInstance(document, out);
                document.open();
                document.add(new Paragraph("CODEIT CareerOS",
                        FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11)));
                Paragraph heading = new Paragraph(title, titleFont);
                heading.setSpacingBefore(4);
                heading.setSpacingAfter(2);
                document.add(heading);
                Paragraph sub = new Paragraph(institution + "  •  Generated " + formatDate(Instant.now()),
                        smallFont);
                sub.setSpacingAfter(12);
                document.add(sub);
            } catch (Exception e) {
                throw BusinessException.badRequest("Could not start the PDF report: " + e.getMessage());
            }
        }

        void addSection(String heading) {
            try {
                Paragraph p = new Paragraph(heading, h1Font);
                p.setSpacingBefore(14);
                p.setSpacingAfter(6);
                document.add(p);
            } catch (Exception e) {
                throw BusinessException.badRequest("Could not write the PDF report: " + e.getMessage());
            }
        }

        void addKeyValue(String key, String value) {
            addBody(key + ": " + (value == null ? "—" : value));
        }

        void addBody(String text) {
            try {
                Paragraph p = new Paragraph(text == null ? "—" : text, normalFont);
                p.setSpacingAfter(3);
                document.add(p);
            } catch (Exception e) {
                throw BusinessException.badRequest("Could not write the PDF report: " + e.getMessage());
            }
        }

        PdfPTable table(int columns) {
            PdfPTable table = new PdfPTable(columns);
            table.setWidthPercentage(100);
            return table;
        }

        void header(PdfPTable table, List<String> headers) {
            headers.forEach(h -> {
                PdfPCell cell = new PdfPCell(new Phrase(h, smallFont));
                cell.setBackgroundColor(new java.awt.Color(255, 122, 26));
                cell.setPadding(6);
                table.addCell(cell);
            });
        }

        void row(PdfPTable table, List<String> values) {
            values.forEach(v -> {
                PdfPCell cell = new PdfPCell(new Phrase(v == null ? "—" : v, smallFont));
                cell.setPadding(5);
                table.addCell(cell);
            });
        }

        void addTable(PdfPTable table) {
            try {
                table.setSpacingBefore(6);
                table.setSpacingAfter(6);
                document.add(table);
            } catch (Exception e) {
                throw BusinessException.badRequest("Could not write the PDF report: " + e.getMessage());
            }
        }

        byte[] bytes() {
            try {
                document.close();
                return out.toByteArray();
            } catch (Exception e) {
                throw BusinessException.badRequest("Could not finish the PDF report: " + e.getMessage());
            }
        }
    }
}

package com.codeit.careeros.placement.service;

import com.codeit.careeros.college.dto.DashboardDtos;
import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.college.service.AuditService;
import com.codeit.careeros.college.service.CollegeScope;
import com.codeit.careeros.college.service.StudentCsvService;
import com.codeit.careeros.college.service.StudentService;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.placement.dto.PlacementDtos;
import com.codeit.careeros.placement.entity.PlacementApplication;
import com.codeit.careeros.placement.entity.PlacementDrive;
import com.codeit.careeros.placement.entity.PlacementOffer;
import com.codeit.careeros.placement.enums.ApplicationStage;
import com.codeit.careeros.placement.enums.OfferStatus;
import com.codeit.careeros.placement.repository.PlacementApplicationRepository;
import com.codeit.careeros.placement.repository.PlacementOfferRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Phase 4 placement analytics. Every percentage has a documented denominator:
 * active students in batches with graduation year {@code <= current year + 1}
 * (or no graduation year), after applying the caller's academic scope.
 * Multiple offers to one student never increase placed-student counts.
 */
@Service
@RequiredArgsConstructor
public class PlacementAnalyticsService {

    private static final int MAX_EXPORT_ROWS = 10_000;

    private final StudentService studentService;
    private final PlacementService placementService;
    private final PlacementApplicationRepository applicationRepository;
    private final PlacementOfferRepository offerRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public PlacementDtos.PlacementAnalyticsResponse analytics(CollegeScope scope,
                                                              StudentDtos.StudentFilter filter) {
        scope.requirePlacementReports();
        Snapshot snapshot = snapshot(scope, filter);
        return new PlacementDtos.PlacementAnalyticsResponse(
                scope.institutionName(),
                denominatorDefinition(),
                definitions(),
                snapshot.eligibleGraduating().size(),
                snapshot.participantIds().size(),
                snapshot.applications().size(),
                (int) snapshot.applications().stream()
                        .filter(app -> app.getStage() != ApplicationStage.WITHDRAWN
                                && app.getStage() != ApplicationStage.REJECTED)
                        .count(),
                snapshot.offers().size(),
                snapshot.offerStudentIds().size(),
                snapshot.acceptedStudentIds().size(),
                snapshot.joinedStudentIds().size(),
                rate(snapshot.participantIds().size(), snapshot.eligibleGraduating().size()),
                rate(snapshot.offerStudentIds().size(), snapshot.eligibleGraduating().size()),
                rate(snapshot.joinedStudentIds().size(), snapshot.eligibleGraduating().size()),
                departmentOutcomes(snapshot),
                companyOutcomes(snapshot),
                stageCounts(snapshot),
                Instant.now());
    }

    @Transactional(readOnly = true)
    public CsvExport export(CollegeScope scope, StudentDtos.StudentFilter filter, String type) {
        scope.requirePlacementReports();
        if (!scope.canExport()) {
            throw BusinessException.forbidden("Your role cannot export placement data");
        }
        if (type == null || type.isBlank()) {
            throw BusinessException.badRequest("A placement report type is required");
        }
        Snapshot snapshot = snapshot(scope, filter);
        String normalized = type.trim().toLowerCase(java.util.Locale.ROOT);
        List<List<String>> rows = switch (normalized) {
            case "placement-summary" -> summaryRows(snapshot);
            case "department-outcomes" -> departmentRows(snapshot);
            case "company-outcomes" -> companyRows(snapshot);
            case "stage-progress" -> stageRows(snapshot);
            default -> throw BusinessException.badRequest(
                    "Unknown placement report type. Use placement-summary, department-outcomes, "
                            + "company-outcomes or stage-progress.");
        };
        if (rows.size() - 1 > MAX_EXPORT_ROWS) {
            throw BusinessException.badRequest("The placement export exceeds 10,000 data rows; narrow the filters");
        }
        StringBuilder csv = new StringBuilder("\uFEFF");
        for (List<String> row : rows) {
            csv.append(row.stream().map(StudentCsvService::escape)
                    .collect(Collectors.joining(","))).append("\r\n");
        }
        auditService.success("PLACEMENT_REPORT_EXPORT", "PLACEMENT_REPORT", null,
                scope.institutionId(), scope, "type=" + normalized + ",rows=" + Math.max(0, rows.size() - 1));
        return new CsvExport("careeros-" + normalized + ".csv",
                csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private Snapshot snapshot(CollegeScope scope, StudentDtos.StudentFilter filter) {
        List<StudentEnrollment> enrollments = studentService.allInScope(scope, filter);
        Map<Long, StudentEnrollment> byProfile = new LinkedHashMap<>();
        for (StudentEnrollment enrollment : enrollments) {
            byProfile.put(enrollment.getStudentProfile().getId(), enrollment);
        }
        List<StudentEnrollment> eligibleGraduating = enrollments.stream()
                .filter(enrollment -> enrollment.getStatus() == EnrollmentStatus.ACTIVE)
                .filter(enrollment -> enrollment.getBatch().getGraduationYear() == null
                        || enrollment.getBatch().getGraduationYear() <= LocalDate.now(scope.institutionZone()).getYear() + 1)
                .toList();

        Set<Long> visibleDriveIds = placementService.listDrives(scope, null).stream()
                .map(PlacementDtos.DriveResponse::id)
                .collect(Collectors.toSet());
        List<PlacementApplication> applications = applicationRepository
                .findByInstitutionIdOrderByAppliedAtDesc(scope.institutionId()).stream()
                .filter(app -> visibleDriveIds.contains(app.getDrive().getId()))
                .filter(app -> byProfile.containsKey(app.getStudentProfile().getId()))
                .toList();
        Map<Long, PlacementApplication> appById = applications.stream()
                .collect(Collectors.toMap(PlacementApplication::getId, app -> app));
        List<PlacementOffer> offers = offerRepository
                .findByInstitutionIdOrderByCreatedAtDesc(scope.institutionId()).stream()
                .filter(offer -> appById.containsKey(offer.getApplication().getId()))
                .toList();
        Set<Long> eligibleProfileIds = eligibleGraduating.stream()
                .map(enrollment -> enrollment.getStudentProfile().getId())
                .collect(Collectors.toSet());
        Set<Long> participantIds = applications.stream()
                .filter(app -> app.getStage() != ApplicationStage.WITHDRAWN)
                .filter(app -> eligibleProfileIds.contains(app.getStudentProfile().getId()))
                .map(app -> app.getStudentProfile().getId())
                .collect(Collectors.toCollection(HashSet::new));
        Set<Long> offerStudentIds = offers.stream()
                .filter(offer -> offer.getStatus() != OfferStatus.WITHDRAWN)
                .filter(offer -> eligibleProfileIds.contains(offer.getApplication().getStudentProfile().getId()))
                .map(offer -> offer.getApplication().getStudentProfile().getId())
                .collect(Collectors.toCollection(HashSet::new));
        Set<Long> acceptedStudentIds = offers.stream()
                .filter(offer -> offer.getStatus() == OfferStatus.ACCEPTED || offer.getStatus() == OfferStatus.JOINED)
                .filter(offer -> eligibleProfileIds.contains(offer.getApplication().getStudentProfile().getId()))
                .map(offer -> offer.getApplication().getStudentProfile().getId())
                .collect(Collectors.toCollection(HashSet::new));
        Set<Long> joinedStudentIds = offers.stream()
                .filter(offer -> offer.getStatus() == OfferStatus.JOINED)
                .filter(offer -> eligibleProfileIds.contains(offer.getApplication().getStudentProfile().getId()))
                .map(offer -> offer.getApplication().getStudentProfile().getId())
                .collect(Collectors.toCollection(HashSet::new));
        return new Snapshot(enrollments, eligibleGraduating, byProfile, applications, offers,
                participantIds, offerStudentIds, acceptedStudentIds, joinedStudentIds, visibleDriveIds);
    }

    private List<PlacementDtos.DepartmentOutcome> departmentOutcomes(Snapshot snapshot) {
        Map<Long, List<StudentEnrollment>> byDepartment = snapshot.eligibleGraduating().stream()
                .collect(Collectors.groupingBy(e -> e.getDepartment().getId(), LinkedHashMap::new, Collectors.toList()));
        List<PlacementDtos.DepartmentOutcome> rows = new ArrayList<>();
        for (var entry : byDepartment.entrySet()) {
            Long departmentId = entry.getKey();
            String name = entry.getValue().get(0).getDepartment().getName();
            Set<Long> departmentProfiles = entry.getValue().stream()
                    .map(e -> e.getStudentProfile().getId()).collect(Collectors.toSet());
            int participants = (int) snapshot.participantIds().stream().filter(departmentProfiles::contains).count();
            int offers = (int) snapshot.offerStudentIds().stream().filter(departmentProfiles::contains).count();
            int joined = (int) snapshot.joinedStudentIds().stream().filter(departmentProfiles::contains).count();
            int eligible = entry.getValue().size();
            rows.add(new PlacementDtos.DepartmentOutcome(
                    departmentId, name, eligible, participants, offers, joined,
                    rate(participants, eligible), rate(joined, eligible)));
        }
        rows.sort(Comparator.comparing(PlacementDtos.DepartmentOutcome::departmentName,
                String.CASE_INSENSITIVE_ORDER));
        return rows;
    }

    private List<PlacementDtos.CompanyOutcome> companyOutcomes(Snapshot snapshot) {
        Map<Long, List<PlacementApplication>> byCompany = snapshot.applications().stream()
                .collect(Collectors.groupingBy(app -> app.getDrive().getCompany().getId(),
                        LinkedHashMap::new, Collectors.toList()));
        List<PlacementDtos.CompanyOutcome> rows = new ArrayList<>();
        for (var entry : byCompany.entrySet()) {
            Long companyId = entry.getKey();
            String name = entry.getValue().get(0).getDrive().getCompany().getName();
            long drives = entry.getValue().stream().map(app -> app.getDrive().getId()).distinct().count();
            long applications = entry.getValue().size();
            long offers = snapshot.offers().stream()
                    .filter(offer -> offer.getApplication().getDrive().getCompany().getId().equals(companyId))
                    .count();
            Set<Long> joined = snapshot.offers().stream()
                    .filter(offer -> offer.getApplication().getDrive().getCompany().getId().equals(companyId))
                    .filter(offer -> offer.getStatus() == OfferStatus.JOINED)
                    .map(offer -> offer.getApplication().getStudentProfile().getId())
                    .collect(Collectors.toSet());
            rows.add(new PlacementDtos.CompanyOutcome(companyId, name, drives, applications, offers, joined.size()));
        }
        rows.sort(Comparator.comparing(PlacementDtos.CompanyOutcome::companyName,
                String.CASE_INSENSITIVE_ORDER));
        return rows;
    }

    private List<PlacementDtos.StageCount> stageCounts(Snapshot snapshot) {
        Map<ApplicationStage, Long> counts = new LinkedHashMap<>();
        for (ApplicationStage stage : ApplicationStage.values()) {
            counts.put(stage, 0L);
        }
        for (PlacementApplication application : snapshot.applications()) {
            counts.merge(application.getStage(), 1L, Long::sum);
        }
        return counts.entrySet().stream()
                .map(entry -> new PlacementDtos.StageCount(entry.getKey(), entry.getValue()))
                .toList();
    }

    private List<List<String>> summaryRows(Snapshot snapshot) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("Metric", "Value", "Definition"));
        rows.add(List.of("Eligible graduating students", String.valueOf(snapshot.eligibleGraduating().size()),
                denominatorDefinition()));
        rows.add(List.of("Drive participants", String.valueOf(snapshot.participantIds().size()),
                "Distinct non-withdrawn applicants in the scoped drives"));
        rows.add(List.of("Total applications", String.valueOf(snapshot.applications().size()),
                "All application records in the scoped drives"));
        rows.add(List.of("Offers made", String.valueOf(snapshot.offers().size()),
                "Offer records; a student may receive more than one offer"));
        rows.add(List.of("Students with an offer", String.valueOf(snapshot.offerStudentIds().size()),
                "Distinct students with at least one non-withdrawn offer"));
        rows.add(List.of("Accepted offers (students)", String.valueOf(snapshot.acceptedStudentIds().size()),
                "Distinct students with at least one accepted or joined offer"));
        rows.add(List.of("Joined students", String.valueOf(snapshot.joinedStudentIds().size()),
                "Distinct students with a joined offer"));
        rows.add(List.of("Participation rate", percentText(rate(snapshot.participantIds().size(),
                snapshot.eligibleGraduating().size())), "Participants / eligible graduating students"));
        rows.add(List.of("Offer rate", percentText(rate(snapshot.offerStudentIds().size(),
                snapshot.eligibleGraduating().size())), "Students with an offer / eligible graduating students"));
        rows.add(List.of("Placement rate", percentText(rate(snapshot.joinedStudentIds().size(),
                snapshot.eligibleGraduating().size())), "Joined students / eligible graduating students"));
        return rows;
    }

    private List<List<String>> departmentRows(Snapshot snapshot) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("Department", "Eligible Graduating Students", "Drive Participants",
                "Students With Offer", "Joined Students", "Participation Rate", "Placement Rate"));
        for (PlacementDtos.DepartmentOutcome row : departmentOutcomes(snapshot)) {
            rows.add(List.of(row.departmentName(), String.valueOf(row.eligibleGraduatingStudents()),
                    String.valueOf(row.driveParticipants()), String.valueOf(row.offers()),
                    String.valueOf(row.joined()), percentText(row.participationRate()),
                    percentText(row.placementRate())));
        }
        return rows;
    }

    private List<List<String>> companyRows(Snapshot snapshot) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("Company", "Drives", "Applications", "Offers", "Joined Students"));
        for (PlacementDtos.CompanyOutcome row : companyOutcomes(snapshot)) {
            rows.add(List.of(row.companyName(), String.valueOf(row.drives()),
                    String.valueOf(row.applications()), String.valueOf(row.offers()),
                    String.valueOf(row.joined())));
        }
        return rows;
    }

    private List<List<String>> stageRows(Snapshot snapshot) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("Stage", "Applications"));
        for (PlacementDtos.StageCount count : stageCounts(snapshot)) {
            rows.add(List.of(count.stage().name(), String.valueOf(count.applications())));
        }
        return rows;
    }

    private static Integer rate(int numerator, int denominator) {
        return denominator == 0 ? null : Math.round(numerator * 100.0f / denominator);
    }

    private static String percentText(Integer value) {
        return value == null ? "" : value + "%";
    }

    private static String denominatorDefinition() {
        return "Active students in batches whose graduation year is the current year + 1 or earlier "
                + "(students without a graduation year are included), after applying the caller's academic scope.";
    }

    private static List<DashboardDtos.MetricDefinition> definitions() {
        return List.of(
                new DashboardDtos.MetricDefinition("eligibleGraduatingStudents", denominatorDefinition()),
                new DashboardDtos.MetricDefinition("driveParticipants",
                        "Distinct non-withdrawn applicants in the scoped placement drives."),
                new DashboardDtos.MetricDefinition("offersMade",
                        "Offer records, not distinct students. Multiple offers to one student are counted separately here."),
                new DashboardDtos.MetricDefinition("studentsWithOffer",
                        "Distinct students with at least one non-withdrawn offer."),
                new DashboardDtos.MetricDefinition("acceptedOffers",
                        "Distinct students with at least one accepted or joined offer."),
                new DashboardDtos.MetricDefinition("joinedStudents",
                        "Distinct students with a joined offer."),
                new DashboardDtos.MetricDefinition("placementRate",
                        "Joined students divided by eligible graduating students."),
                new DashboardDtos.MetricDefinition("offerRate",
                        "Students with an offer divided by eligible graduating students."));
    }

    public record CsvExport(String filename, byte[] bytes) {
    }

    private record Snapshot(
            List<StudentEnrollment> enrollments,
            List<StudentEnrollment> eligibleGraduating,
            Map<Long, StudentEnrollment> byProfile,
            List<PlacementApplication> applications,
            List<PlacementOffer> offers,
            Set<Long> participantIds,
            Set<Long> offerStudentIds,
            Set<Long> acceptedStudentIds,
            Set<Long> joinedStudentIds,
            Set<Long> visibleDriveIds) {
    }
}

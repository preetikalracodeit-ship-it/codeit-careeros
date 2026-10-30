import { AppError } from "../../lib/errors.js";
import { recordInstitutionEvent } from "../../lib/audit.js";
import { toCsv } from "../../lib/csv.js";
import { buildPdf } from "../../lib/pdf.js";
import { getStudentReadiness } from "../students/readiness.service.js";
import { getCollegeDashboard } from "./collegeDashboard.service.js";
import {
  assessmentContexts,
  hasAttemptInRange,
  getStudentDetail,
  listItem,
  loadCohort,
  type StudentFilter,
} from "./studentEnrollment.service.js";
import {
  requireExport,
  requireReports,
  type CollegeScope,
} from "./collegeScope.service.js";

const MAX_REPORT_ROWS = 10_000;

const REPORT_TYPES = {
  roster: "student-roster",
  "assessment-completion": "assessment-completion",
  "readiness-summary": "readiness-summary",
  "department-skill-gaps": "department-skill-gaps",
  "batch-assessment-coverage": "batch-assessment-coverage",
} as const;

type ReportType = keyof typeof REPORT_TYPES;

function parseReportType(value: string | undefined): ReportType {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || !Object.hasOwn(REPORT_TYPES, normalized)) {
    throw AppError.badRequest(normalized ? "Unsupported report type" : "A report type is required");
  }
  return normalized as ReportType;
}

function percent(value: number | null | undefined): string {
  return value == null ? "" : `${value}%`;
}

async function reportRows(scope: CollegeScope, filter: StudentFilter) {
  const rows = await loadCohort(scope, filter);
  if (rows.length > MAX_REPORT_ROWS) {
    throw AppError.badRequest(`This report exceeds ${MAX_REPORT_ROWS} rows; narrow the filters and try again`);
  }
  return rows;
}

export async function exportStudentRoster(scope: CollegeScope, filter: StudentFilter) {
  requireExport(scope);
  const rows = await reportRows(scope, filter);
  const items = await Promise.all(rows.map((row) => listItem(row, filter, scope.timezone)));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const bytes = toCsv([[
    "Student ID", "Roll Number", "Full Name", "Department", "Program", "Batch",
    "Section", "Academic Year", "Status", "Target Career", "Readiness %", "Assessment Completed",
  ], ...rows.map((row) => {
    const item = itemById.get(row.enrollment._id)!;
    return [
      item.studentId, item.rollNumber, item.fullName, item.departmentName, item.programName,
      item.batchLabel, row.section?.name ?? "", row.academicYear?.label ?? "", item.status,
      item.targetCareerName ?? "", percent(item.readinessPercent), item.assessmentCompleted ? "Yes" : "No",
    ];
  })]);
  await recordInstitutionEvent({
    actorUserId: scope.userId,
    actorRole: scope.designation,
    actorEmail: scope.user.email,
    action: "STUDENT_EXPORT_CSV",
    targetType: "STUDENT_EXPORT",
    institutionId: scope.institutionId,
    scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
    details: `rows=${rows.length}`,
  });
  return { filename: `careeros-students-${Date.now()}.csv`, bytes };
}

export async function exportCollegeCsv(
  scope: CollegeScope,
  filter: StudentFilter,
  reportTypeValue: string | undefined,
) {
  requireReports(scope);
  requireExport(scope);
  const reportType = parseReportType(reportTypeValue);
  const rows = await reportRows(scope, filter);
  const items = await Promise.all(rows.map((row) => listItem(row, filter, scope.timezone)));
  const itemByEnrollmentId = new Map(items.map((item) => [item.id, item]));
  let csvRows: unknown[][];

  if (reportType === "roster") {
    csvRows = [[
      "Student ID", "Roll Number", "Full Name", "Department", "Program", "Batch",
      "Section", "Academic Year", "Enrollment Status", "Target Career", "Readiness %",
      "Assessment Completed",
    ], ...rows.map((row) => {
      const item = itemByEnrollmentId.get(row.enrollment._id)!;
      return [
        item.studentId, item.rollNumber, item.fullName, item.departmentName, item.programName,
        item.batchLabel, row.section?.name ?? "", row.academicYear?.label ?? "", item.status,
        item.targetCareerName ?? "", percent(item.readinessPercent), item.assessmentCompleted ? "Yes" : "No",
      ];
    })];
  } else if (reportType === "assessment-completion") {
    csvRows = [[
      "Student ID", "Roll Number", "Full Name", "Department", "Program", "Batch",
      "Enrollment Status", "Assessment Status",
    ], ...rows.map((row) => {
      const item = itemByEnrollmentId.get(row.enrollment._id)!;
      return [
        item.studentId, item.rollNumber, item.fullName, item.departmentName, item.programName,
        item.batchLabel, item.status, item.assessmentCompleted ? "ASSESSED" : "NOT_ASSESSED",
      ];
    })];
  } else if (reportType === "readiness-summary") {
    csvRows = [[
      "Student ID", "Roll Number", "Full Name", "Department", "Program", "Batch",
      "Enrollment Status", "Target Career", "Readiness Status", "Readiness %",
      "Assessed Skills", "Target Skills",
    ]];
    for (const row of rows) {
      const item = itemByEnrollmentId.get(row.enrollment._id)!;
      const readiness = await getStudentReadiness(row.userId);
      const status = !readiness.hasTarget
        ? "NO_TARGET"
        : readiness.submittedAttempts === 0 ? "NOT_ASSESSED" : "EVALUATED";
      csvRows.push([
        item.studentId, item.rollNumber, item.fullName, item.departmentName, item.programName,
        item.batchLabel, item.status, readiness.targetCareerName ?? "", status,
        readiness.hasTarget ? percent(readiness.readinessPercent) : "",
        readiness.assessedSkills, readiness.totalSkills,
      ]);
    }
  } else if (reportType === "department-skill-gaps") {
    const aggregates = new Map<string, {
      departmentId: number;
      skillId: number;
      department: string;
      skill: string;
      assessed: Set<number>;
      belowTarget: Set<number>;
    }>();
    for (const row of rows) {
      if (row.enrollment.status !== "ACTIVE") continue;
      const readiness = await getStudentReadiness(row.userId);
      if (!readiness.hasTarget) continue;
      for (const gap of readiness.gaps) {
        if (!gap.assessed || gap.skillId == null) continue;
        const key = `${row.department._id}:${gap.skillId}`;
        const aggregate = aggregates.get(key) ?? {
          departmentId: row.department._id,
          skillId: gap.skillId,
          department: row.department.name,
          skill: gap.skillName,
          assessed: new Set<number>(),
          belowTarget: new Set<number>(),
        };
        aggregate.assessed.add(row.enrollment._id);
        if (!gap.metTarget) aggregate.belowTarget.add(row.enrollment._id);
        aggregates.set(key, aggregate);
      }
    }
    csvRows = [[
      "Department", "Skill", "Students Below Target", "Assessed Students", "% Below",
    ], ...[...aggregates.values()]
      .sort((a, b) => a.departmentId - b.departmentId || a.skillId - b.skillId)
      .map((aggregate) => {
        const below = aggregate.belowTarget.size;
        const assessed = aggregate.assessed.size;
        return [
          aggregate.department, aggregate.skill, below, assessed,
          assessed ? `${Math.round((below * 100) / assessed)}%` : "",
        ];
      })];
  } else {
    const contexts = await assessmentContexts(rows.map((row) => row.userId));
    const aggregates = new Map<number, {
      department: string;
      program: string;
      batch: string;
      academicYear: string;
      enrolled: number;
      active: number;
      assessedActive: number;
    }>();
    for (const row of rows) {
      const aggregate = aggregates.get(row.batch._id) ?? {
        department: row.department.name,
        program: row.program.name,
        batch: row.batch.label,
        academicYear: row.academicYear?.label ?? "",
        enrolled: 0,
        active: 0,
        assessedActive: 0,
      };
      aggregate.enrolled++;
      if (row.enrollment.status === "ACTIVE") {
        aggregate.active++;
        if (hasAttemptInRange(contexts.get(row.userId), filter, scope.timezone)) aggregate.assessedActive++;
      }
      aggregates.set(row.batch._id, aggregate);
    }
    csvRows = [[
      "Department", "Program", "Batch", "Academic Year", "Enrolled", "Active",
      "Assessed Active", "Not Assessed Active", "Active Coverage %",
    ], ...[...aggregates.values()].map((aggregate) => [
      aggregate.department, aggregate.program, aggregate.batch, aggregate.academicYear,
      aggregate.enrolled, aggregate.active, aggregate.assessedActive,
      aggregate.active - aggregate.assessedActive,
      aggregate.active ? `${Math.round((aggregate.assessedActive * 100) / aggregate.active)}%` : "",
    ])];
  }

  const filename = `careeros-${REPORT_TYPES[reportType]}-${Date.now()}.csv`;
  const bytes = toCsv(csvRows);
  await recordInstitutionEvent({
    actorUserId: scope.userId,
    actorRole: scope.designation,
    actorEmail: scope.user.email,
    action: "STUDENT_REPORT_CSV",
    targetType: "STUDENT_REPORT",
    targetId: reportType.toUpperCase().replaceAll("-", "_"),
    institutionId: scope.institutionId,
    scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
    details: `rows=${rows.length}`,
  });
  return { filename, bytes };
}

export async function generateCohortPdf(scope: CollegeScope, filter: StudentFilter) {
  requireReports(scope);
  const dashboard = await getCollegeDashboard(scope, filter);
  const pdf = buildPdf("Institution Cohort Report", scope.institutionName, (doc) => {
    doc.heading("Summary");
    doc.keyValue("Total enrolled", dashboard.totalEnrolled);
    doc.keyValue("Active students", dashboard.activeStudents);
    doc.keyValue(
      "Assessed active students",
      `${dashboard.assessmentParticipants} (${dashboard.assessmentCompletionPercent == null ? "—" : `${dashboard.assessmentCompletionPercent}%`})`,
    );
    doc.keyValue("Active students not assessed", dashboard.studentsNotAssessed);
    doc.keyValue("Readiness evaluated", dashboard.readinessEvaluated);
    doc.keyValue("Readiness unavailable", dashboard.readinessUnavailable);

    doc.heading("Readiness distribution");
    doc.table(["Band", "Students"], dashboard.readinessDistribution.map((band) => [band.band, band.students]));

    doc.heading("Common skill gaps");
    if (dashboard.commonGaps.length === 0) {
      doc.text("No assessed skill gaps are available for the selected cohort.");
    } else {
      doc.table(
        ["Skill", "Below target", "Assessed", "% below"],
        dashboard.commonGaps.map((gap) => [
          gap.skillName, gap.studentsBelowTarget, gap.assessedStudents, `${gap.percentBelowTarget}%`,
        ]),
      );
    }

    doc.heading("Department comparison");
    if (dashboard.departmentComparisons.length === 0) {
      doc.text("No enrollments match the selected filters.");
    } else {
      doc.table(
        ["Department", "Enrolled", "Active", "Evaluated", "Avg readiness"],
        dashboard.departmentComparisons.map((department) => [
          department.departmentName,
          department.enrolled,
          department.active,
          department.readinessEvaluated,
          department.averageReadinessPercent == null ? "—" : `${department.averageReadinessPercent}%`,
        ]),
      );
    }
    doc.text(`Trend: ${dashboard.trendUnavailableReason}`);
  });
  await recordInstitutionEvent({
    actorUserId: scope.userId,
    actorRole: scope.designation,
    actorEmail: scope.user.email,
    action: "REPORT_COHORT_PDF",
    targetType: "REPORT",
    institutionId: scope.institutionId,
    scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
    details: `students=${dashboard.totalEnrolled}`,
  });
  return {
    filename: `careeros-cohort-report-${Date.now()}.pdf`,
    bytes: pdf,
  };
}

export async function generateStudentPdf(scope: CollegeScope, enrollmentId: number) {
  requireReports(scope);
  const detail = await getStudentDetail(scope, enrollmentId);
  const { profile, enrollment, readiness, roadmap, projects } = detail;
  const pdf = buildPdf("Student 360 Report", scope.institutionName, (doc) => {
    doc.heading("Student");
    doc.keyValue("Name", profile.fullName);
    doc.keyValue("Student ID", profile.studentId);
    doc.keyValue("Roll number", enrollment.rollNumber);
    doc.keyValue("Program", enrollment.programName);
    doc.keyValue("Department", enrollment.departmentName);
    doc.keyValue("Batch", enrollment.batchLabel);
    doc.keyValue("Academic year", enrollment.academicYearLabel);
    doc.keyValue("Enrollment status", enrollment.status);

    doc.heading("Career readiness");
    if (readiness.hasTarget) {
      doc.keyValue("Target career", readiness.targetCareerName);
      doc.keyValue("Readiness", `${readiness.readinessPercent}% (${readiness.readinessLevel})`);
      doc.keyValue("Assessed skills", `${readiness.assessedSkills} of ${readiness.totalSkills}`);
      if (readiness.improvements.length > 0) {
        doc.text("Priority improvements:");
        for (const gap of readiness.improvements) {
          doc.bullet(
            `${gap.skillName}: ${gap.assessed ? `${gap.scorePercent}%` : "not assessed"} vs target ${gap.targetPercent}%`,
          );
        }
      }
    } else {
      doc.text("No target career selected; readiness is unavailable.");
    }

    doc.heading("Learning and projects");
    doc.text(roadmap.hasTarget
      ? `${roadmap.completedItems} of ${roadmap.totalItems} roadmap steps completed (${roadmap.progressPercent}%).`
      : "No roadmap available.");
    doc.text(`${projects.totalProjects} recommended projects; ${projects.completedProjects} completed.`);
  });
  await recordInstitutionEvent({
    actorUserId: scope.userId,
    actorRole: scope.designation,
    actorEmail: scope.user.email,
    action: "REPORT_STUDENT_PDF",
    targetType: "STUDENT_ENROLLMENT",
    targetId: String(enrollmentId),
    institutionId: scope.institutionId,
    scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
    details: "student360",
  });
  return {
    filename: `careeros-student-${enrollmentId}-report.pdf`,
    bytes: pdf,
  };
}

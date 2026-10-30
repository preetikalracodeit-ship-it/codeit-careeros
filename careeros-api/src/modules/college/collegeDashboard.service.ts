import { AppError } from "../../lib/errors.js";
import { getStudentReadiness } from "../students/readiness.service.js";
import {
  assessmentContexts,
  hasAttemptForCareerInRange,
  hasAttemptInRange,
  loadCohort,
  type StudentFilter,
} from "./studentEnrollment.service.js";
import type { CollegeScope } from "./collegeScope.service.js";

const METRIC_DEFINITIONS = [
  { metric: "totalEnrolled", definition: "All student enrollments matching the selected filters." },
  { metric: "activeStudents", definition: "Enrollments whose status is ACTIVE." },
  { metric: "assessmentParticipants", definition: "Active students with at least one submitted assessment attempt." },
  { metric: "studentsNotAssessed", definition: "Active students with no submitted assessment attempt." },
  { metric: "assessmentCompletionPercent", definition: "Active students with a submitted attempt divided by all active students." },
  { metric: "readinessEvaluated", definition: "Active students with a target career and at least one submitted assessment for that career." },
  { metric: "readinessDistribution", definition: "Evaluated students grouped by readiness percentage band." },
  { metric: "commonGaps", definition: "Skills where assessed students scored below the live career framework target." },
];

type GapAggregate = { skillId: number; skillName: string; assessed: number; belowTarget: number };
type DepartmentAggregate = {
  departmentId: number;
  departmentName: string;
  enrolled: number;
  active: number;
  assessmentParticipants: number;
  readinessEvaluated: number;
  readinessTotal: number;
};
type BatchAggregate = {
  batchId: number;
  departmentName: string;
  programName: string;
  batchLabel: string;
  enrolled: number;
  active: number;
  assessmentParticipants: number;
};

function percentage(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator * 100) / denominator);
}

export async function getCollegeDashboard(scope: CollegeScope, filter: StudentFilter = {}) {
  if (filter.assessmentDateFrom && filter.assessmentDateTo &&
      filter.assessmentDateFrom > filter.assessmentDateTo) {
    throw AppError.badRequest("Assessment submission start date must be on or before end date");
  }
  if (filter.assessmentDateTo === "9999-12-31") {
    throw AppError.badRequest("Assessment submission end date is out of range");
  }

  const cohortFilter = {
    ...filter,
    assessmentDateFrom: null,
    assessmentDateTo: null,
    assessmentCompleted: filter.assessmentDateFrom || filter.assessmentDateTo
      ? null
      : filter.assessmentCompleted,
    readinessEvaluated: null,
  };
  const cohort = await loadCohort(scope, cohortFilter);
  const contexts = await assessmentContexts(cohort.map((row) => row.userId));

  let activeStudents = 0;
  let assessmentParticipants = 0;
  let readinessEvaluated = 0;
  const bands = [0, 0, 0, 0];
  const gaps = new Map<number, GapAggregate>();
  const departments = new Map<number, DepartmentAggregate>();
  const batches = new Map<number, BatchAggregate>();

  for (const row of cohort) {
    const active = row.enrollment.status === "ACTIVE";
    if (active) activeStudents++;
    const context = contexts.get(row.userId);
    const hasAttempts = hasAttemptInRange(context, filter, scope.timezone);
    if (active && hasAttempts) assessmentParticipants++;

    let readinessPercent: number | null = null;
    if (active && row.profile.targetCareerId &&
        hasAttemptForCareerInRange(context, row.profile.targetCareerId, filter, scope.timezone)) {
      const readiness = await getStudentReadiness(row.userId);
      if (readiness.hasTarget && readiness.readinessPercent != null) {
        readinessPercent = readiness.readinessPercent;
        readinessEvaluated++;
        if (readinessPercent < 25) bands[0]++;
        else if (readinessPercent < 50) bands[1]++;
        else if (readinessPercent < 75) bands[2]++;
        else bands[3]++;

        for (const gap of readiness.gaps) {
          if (!gap.assessed || gap.skillId == null) continue;
          const aggregate = gaps.get(gap.skillId) ?? {
            skillId: gap.skillId,
            skillName: gap.skillName,
            assessed: 0,
            belowTarget: 0,
          };
          aggregate.assessed++;
          if (!gap.metTarget) aggregate.belowTarget++;
          gaps.set(gap.skillId, aggregate);
        }
      }
    }

    const department = departments.get(row.department._id) ?? {
      departmentId: row.department._id,
      departmentName: row.department.name,
      enrolled: 0,
      active: 0,
      assessmentParticipants: 0,
      readinessEvaluated: 0,
      readinessTotal: 0,
    };
    department.enrolled++;
    if (active) department.active++;
    if (active && hasAttempts) department.assessmentParticipants++;
    if (readinessPercent != null) {
      department.readinessEvaluated++;
      department.readinessTotal += readinessPercent;
    }
    departments.set(row.department._id, department);

    const batch = batches.get(row.batch._id) ?? {
      batchId: row.batch._id,
      departmentName: row.department.name,
      programName: row.program.name,
      batchLabel: row.batch.label,
      enrolled: 0,
      active: 0,
      assessmentParticipants: 0,
    };
    batch.enrolled++;
    if (active) batch.active++;
    if (active && hasAttempts) batch.assessmentParticipants++;
    batches.set(row.batch._id, batch);
  }

  const commonGaps = [...gaps.values()]
    .map((gap) => ({
      skillId: String(gap.skillId),
      skillName: gap.skillName,
      studentsBelowTarget: gap.belowTarget,
      assessedStudents: gap.assessed,
      percentBelowTarget: percentage(gap.belowTarget, gap.assessed)!,
    }))
    .sort((a, b) => b.studentsBelowTarget - a.studentsBelowTarget || a.skillName.localeCompare(b.skillName))
    .slice(0, 10);

  const departmentComparisons = [...departments.values()]
    .map((department) => ({
      departmentId: department.departmentId,
      departmentName: department.departmentName,
      enrolled: department.enrolled,
      active: department.active,
      assessmentParticipants: department.assessmentParticipants,
      readinessEvaluated: department.readinessEvaluated,
      averageReadinessPercent: department.readinessEvaluated
        ? Math.round(department.readinessTotal / department.readinessEvaluated)
        : null,
    }))
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));

  const batchComparisons = [...batches.values()]
    .map((batch) => ({
      ...batch,
      assessmentCoveragePercent: percentage(batch.assessmentParticipants, batch.active),
    }))
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName) ||
      a.programName.localeCompare(b.programName) || a.batchLabel.localeCompare(b.batchLabel));

  return {
    institutionName: scope.institutionName,
    filters: {
      academicYearId: filter.academicYearId ?? null,
      departmentId: filter.departmentId ?? null,
      programId: filter.programId ?? null,
      batchId: filter.batchId ?? null,
      sectionId: filter.sectionId ?? null,
      enrollmentStatus: filter.status ?? null,
      assessmentCompleted: filter.assessmentCompleted ?? null,
      assessmentDateFrom: filter.assessmentDateFrom ?? null,
      assessmentDateTo: filter.assessmentDateTo ?? null,
    },
    definitions: METRIC_DEFINITIONS,
    totalEnrolled: cohort.length,
    activeStudents,
    assessmentParticipants,
    studentsNotAssessed: activeStudents - assessmentParticipants,
    assessmentCompletionPercent: percentage(assessmentParticipants, activeStudents),
    readinessEvaluated,
    readinessUnavailable: activeStudents - readinessEvaluated,
    readinessDistribution: [
      { band: "0-24%", students: bands[0] },
      { band: "25-49%", students: bands[1] },
      { band: "50-74%", students: bands[2] },
      { band: "75-100%", students: bands[3] },
    ],
    commonGaps,
    departmentComparisons,
    batchComparisons,
    trendAvailable: false,
    trendUnavailableReason: "No historical readiness snapshots are stored yet, so a trend cannot be shown without fabricating data.",
    generatedAt: new Date().toISOString(),
  };
}

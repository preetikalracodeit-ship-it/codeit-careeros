import { AppError } from "../../lib/errors.js";
import { recordInstitutionEvent } from "../../lib/audit.js";
import { withTransaction } from "../../lib/db.js";
import { AssessmentAttempt } from "../../models/AssessmentAttempt.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { AcademicYear } from "../../models/AcademicYear.js";
import { Batch } from "../../models/Batch.js";
import { Department } from "../../models/Department.js";
import { Program } from "../../models/Program.js";
import { Section } from "../../models/Section.js";
import { StudentEnrollment, type EnrollmentStatus } from "../../models/StudentEnrollment.js";
import { StudentProfile, type StudentProfileDoc } from "../../models/StudentProfile.js";
import { User } from "../../models/User.js";
import { getAttemptHistory } from "../students/attempt-history.service.js";
import { getStudentReadiness } from "../students/readiness.service.js";
import { getMyRoadmap } from "../roadmaps/roadmap.service.js";
import { getRecommendedProjects } from "../projects/project.service.js";
import type { CollegeScope } from "./collegeScope.service.js";
import {
  requireAcademicYear,
  requireBatch,
  requireDepartment,
  requireProgram,
  requireSection,
} from "./academicStructure.service.js";

export interface StudentFilter {
  search?: string | null;
  academicYearId?: number | null;
  departmentId?: number | null;
  programId?: number | null;
  batchId?: number | null;
  sectionId?: number | null;
  status?: EnrollmentStatus | null;
  assessmentCompleted?: boolean | null;
  readinessEvaluated?: boolean | null;
  assessmentDateFrom?: string | null;
  assessmentDateTo?: string | null;
}

export interface CohortRow {
  enrollment: {
    _id: number;
    studentProfileId: number;
    institutionId: number;
    departmentId: number;
    programId: number;
    batchId: number;
    sectionId?: number | null;
    rollNumber: string;
    status: EnrollmentStatus;
    startDate?: string | null;
    endDate?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  profile: StudentProfileDoc;
  userId: number;
  department: { _id: number; name: string };
  program: { _id: number; name: string };
  batch: { _id: number; label: string; graduationYear?: number | null; academicYearId: number };
  section: { _id: number; name: string } | null;
  academicYear: { _id: number; label: string } | null;
  email: string;
}

interface AssessmentContext {
  submitted: boolean;
  submittedAt: Date[];
  submittedAtByCareer: Map<number, Date[]>;
}

function localDayStart(value: string, timezone: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!);
  let timestamp = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let iteration = 0; iteration < 3; iteration++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]));
    const formatted = Date.UTC(
      parts.year!,
      parts.month! - 1,
      parts.day!,
      parts.hour!,
      parts.minute!,
      parts.second!,
    );
    const adjustment = target - formatted;
    timestamp += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(timestamp);
}

function localDayEndExclusive(value: string, timezone: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year!, month! - 1, day! + 1));
  const nextDate = [
    nextDay.getUTCFullYear(),
    String(nextDay.getUTCMonth() + 1).padStart(2, "0"),
    String(nextDay.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return localDayStart(nextDate, timezone);
}

function dateIso(value: unknown): string | null {
  if (value == null) return null;
  return String(value).slice(0, 10);
}

export function toEnrollmentResponse(row: CohortRow) {
  return {
    id: row.enrollment._id,
    institutionId: row.enrollment.institutionId,
    institutionName: null,
    departmentId: row.enrollment.departmentId,
    departmentName: row.department.name,
    programId: row.enrollment.programId,
    programName: row.program.name,
    batchId: row.enrollment.batchId,
    batchLabel: row.batch.label,
    sectionId: row.enrollment.sectionId ?? null,
    sectionName: row.section?.name ?? null,
    academicYearId: row.batch.academicYearId,
    academicYearLabel: row.academicYear?.label ?? null,
    rollNumber: row.enrollment.rollNumber,
    status: row.enrollment.status,
    startDate: dateIso(row.enrollment.startDate),
    endDate: dateIso(row.enrollment.endDate),
  };
}

export function profileResponse(row: CohortRow) {
  const profile = row.profile;
  return {
    id: profile._id,
    studentId: profile.studentId,
    fullName: profile.fullName,
    email: null,
    mobile: null,
    dateOfBirth: null,
    college: profile.college ?? null,
    degree: profile.degree ?? null,
    branch: profile.branch ?? null,
    graduationYear: profile.graduationYear ?? null,
    semester: profile.semester ?? null,
    location: null,
    githubUrl: null,
    linkedinUrl: null,
    portfolioUrl: null,
    targetCareerId: profile.targetCareerId ?? null,
    targetCareerName: profile.targetCareerName ?? null,
    createdAt: profile.createdAt,
  };
}

function withinRange(
  date: Date | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
  timezone: string,
): boolean {
  if (!date) return false;
  const value = date.getTime();
  if (from && value < localDayStart(from, timezone).getTime()) return false;
  if (to && value >= localDayEndExclusive(to, timezone).getTime()) return false;
  return true;
}

export async function assessmentContexts(userIds: number[]): Promise<Map<number, AssessmentContext>> {
  const result = new Map<number, AssessmentContext>();
  if (userIds.length === 0) return result;
  const attempts = await AssessmentAttempt.find({ userId: { $in: userIds }, status: "SUBMITTED" })
    .select("_id userId assessmentId submittedAt")
    .lean();
  const assessmentIds = [...new Set(attempts.map((attempt) => attempt.assessmentId))];
  const assessments = await AssessmentTest.find({ _id: { $in: assessmentIds } }).select("_id careerId").lean();
  const careerById = new Map(assessments.map((assessment) => [assessment._id, assessment.careerId]));
  for (const userId of userIds) {
    const rows = attempts.filter((attempt) => attempt.userId === userId);
    const submittedAtByCareer = new Map<number, Date[]>();
    for (const row of rows) {
      const careerId = careerById.get(row.assessmentId);
      if (careerId == null || row.submittedAt == null) continue;
      const dates = submittedAtByCareer.get(careerId) ?? [];
      dates.push(row.submittedAt);
      submittedAtByCareer.set(careerId, dates);
    }
    result.set(userId, {
      submitted: rows.some((row) => row.submittedAt != null),
      submittedAt: rows.map((row) => row.submittedAt).filter((value): value is Date => value != null),
      submittedAtByCareer,
    });
  }
  return result;
}

export function hasAttemptInRange(
  context: AssessmentContext | undefined,
  filter: StudentFilter,
  timezone: string,
): boolean {
  if (!context) return false;
  const from = filter.assessmentDateFrom ?? null;
  const to = filter.assessmentDateTo ?? null;
  if (!from && !to) return context.submitted;
  return context.submittedAt.some((date) => withinRange(date, from, to, timezone));
}

export function isReadinessEvaluated(
  row: CohortRow,
  context: AssessmentContext | undefined,
  filter: StudentFilter,
  timezone: string,
): boolean {
  if (!row.profile.targetCareerId || !context) return false;
  const submittedAt = context.submittedAtByCareer.get(row.profile.targetCareerId);
  if (!submittedAt?.length) return false;
  const from = filter.assessmentDateFrom ?? null;
  const to = filter.assessmentDateTo ?? null;
  if (!from && !to) return true;
  return submittedAt.some((date) => withinRange(date, from, to, timezone));
}

export function hasAttemptForCareerInRange(
  context: AssessmentContext | undefined,
  careerId: number,
  filter: StudentFilter,
  timezone: string,
): boolean {
  const submittedAt = context?.submittedAtByCareer.get(careerId);
  if (!submittedAt?.length) return false;
  const from = filter.assessmentDateFrom ?? null;
  const to = filter.assessmentDateTo ?? null;
  return !from && !to || submittedAt.some((date) => withinRange(date, from, to, timezone));
}

export async function loadCohort(scope: CollegeScope, filter: StudentFilter = {}): Promise<CohortRow[]> {
  await validateFilters(scope, filter);
  const query: Record<string, unknown> = { institutionId: scope.institutionId };
  if (scope.scopeType === "DEPARTMENT") query.departmentId = scope.scopeId;
  if (scope.scopeType === "PROGRAM") query.programId = scope.scopeId;
  if (scope.scopeType === "BATCH") query.batchId = scope.scopeId;
  if (scope.scopeType === "SECTION") query.sectionId = scope.scopeId;
  if (filter.departmentId != null) query.departmentId = filter.departmentId;
  if (filter.programId != null) query.programId = filter.programId;
  if (filter.batchId != null) query.batchId = filter.batchId;
  if (filter.sectionId != null) query.sectionId = filter.sectionId;
  if (filter.status != null) query.status = filter.status;

  let enrollments = await StudentEnrollment.find(query).sort({ _id: 1 }).lean();
  if (filter.academicYearId != null) {
    const batchIds = new Set(
      (await Batch.find({ academicYearId: filter.academicYearId }).select("_id").lean()).map((batch) => batch._id),
    );
    enrollments = enrollments.filter((enrollment) => batchIds.has(enrollment.batchId));
  }

  const profileIds = enrollments.map((enrollment) => enrollment.studentProfileId);
  const profiles = await StudentProfile.find({ _id: { $in: profileIds } }).lean();
  const profileById = new Map(profiles.map((profile) => [profile._id, profile]));
  const resolvedUsers = await User.find({ _id: { $in: profiles.map((profile) => profile.userId) } })
    .select("_id email")
    .lean();
  const userById = new Map<number, { _id: number; email: string }>();
  for (const user of resolvedUsers) userById.set(user._id, user);

  const [departments, programs, sections] = await Promise.all([
    Department.find({ _id: { $in: [...new Set(enrollments.map((row) => row.departmentId))] } }).lean(),
    Program.find({ _id: { $in: [...new Set(enrollments.map((row) => row.programId))] } }).lean(),
    Section.find({ _id: { $in: [...new Set(enrollments.map((row) => row.sectionId).filter((id): id is number => id != null))] } }).lean(),
  ]);
  const batchIds = [...new Set(enrollments.map((row) => row.batchId))];
  const batchDocs = await Batch.find({ _id: { $in: batchIds } }).lean();
  const academicYearIds = [...new Set(batchDocs.map((batch) => batch.academicYearId))];
  const academicYears = await AcademicYear.find({ _id: { $in: academicYearIds } }).select("label").lean();

  const departmentById = new Map(departments.map((row) => [row._id, row]));
  const programById = new Map(programs.map((row) => [row._id, row]));
  const batchById = new Map(batchDocs.map((row) => [row._id, row]));
  const yearById = new Map(academicYears.map((row) => [row._id, row]));
  const sectionById = new Map(sections.map((row) => [row._id, row]));

  const rows: CohortRow[] = [];
  for (const enrollment of enrollments) {
    const profile = profileById.get(enrollment.studentProfileId);
    const department = departmentById.get(enrollment.departmentId);
    const program = programById.get(enrollment.programId);
    const batch = batchById.get(enrollment.batchId);
    if (!profile || !department || !program || !batch) continue;
    const section = enrollment.sectionId == null ? null : sectionById.get(enrollment.sectionId) ?? null;
    rows.push({
      enrollment,
      profile,
      userId: profile.userId,
      department: { _id: department._id, name: department.name },
      program: { _id: program._id, name: program.name },
      batch: {
        _id: batch._id,
        label: batch.label,
        graduationYear: batch.graduationYear ?? null,
        academicYearId: batch.academicYearId,
      },
      section: section ? { _id: section._id, name: section.name } : null,
      academicYear: yearById.get(batch.academicYearId)
        ? { _id: batch.academicYearId, label: yearById.get(batch.academicYearId)!.label }
        : null,
      email: userById.get(profile.userId)?.email ?? "",
    });
  }

  const term = filter.search?.trim().toLowerCase();
  const filtered = term
    ? rows.filter((row) =>
        [row.profile.fullName, row.profile.studentId, row.enrollment.rollNumber]
          .some((value) => String(value ?? "").toLowerCase().includes(term)),
      )
    : rows;

  if (filter.assessmentCompleted == null && filter.readinessEvaluated == null &&
      !filter.assessmentDateFrom && !filter.assessmentDateTo) {
    return filtered;
  }
  const contexts = await assessmentContexts(filtered.map((row) => row.userId));
  return filtered.filter((row) => {
    const context = contexts.get(row.userId);
    if (filter.assessmentCompleted != null && hasAttemptInRange(context, filter, scope.timezone) !== filter.assessmentCompleted) {
      return false;
    }
    if (filter.readinessEvaluated != null && isReadinessEvaluated(row, context, filter, scope.timezone) !== filter.readinessEvaluated) {
      return false;
    }
    return true;
  });
}

export async function listItem(row: CohortRow, filter: StudentFilter = {}, timezone = "UTC") {
  const readiness = await getStudentReadiness(row.userId);
  const contexts = await assessmentContexts([row.userId]);
  return {
    id: row.enrollment._id,
    studentId: row.profile.studentId,
    fullName: row.profile.fullName,
    email: null,
    rollNumber: row.enrollment.rollNumber,
    departmentId: row.department._id,
    departmentName: row.department.name,
    programId: row.program._id,
    programName: row.program.name,
    batchId: row.batch._id,
    batchLabel: row.batch.label,
    sectionId: row.section?._id ?? null,
    sectionName: row.section?.name ?? null,
    academicYearLabel: row.academicYear?.label ?? null,
    status: row.enrollment.status,
    targetCareerName: row.profile.targetCareerName ?? null,
    readinessPercent: readiness.hasTarget ? readiness.readinessPercent : null,
    assessmentCompleted: hasAttemptInRange(contexts.get(row.userId), filter, timezone),
  };
}

export async function listStudents(
  scope: CollegeScope,
  filter: StudentFilter,
  page: number,
  size: number,
  sortBy: string,
  sortDir: string,
) {
  const rows = await loadCohort(scope, filter);
  const safePage = Math.max(0, page);
  const safeSize = Math.min(Math.max(1, size), 100);
  const direction = sortDir === "desc" ? -1 : 1;
  const sortable: Record<string, (row: CohortRow) => string | number> = {
    fullName: (row) => row.profile.fullName.toLowerCase(),
    studentId: (row) => row.profile.studentId,
    rollNumber: (row) => row.enrollment.rollNumber,
    status: (row) => row.enrollment.status,
    createdAt: (row) => row.enrollment.createdAt.getTime(),
  };
  const key = sortable[sortBy] ? sortBy : "fullName";
  rows.sort((a, b) => {
    const left = sortable[key]!(a);
    const right = sortable[key]!(b);
    if (left < right) return -1 * direction;
    if (left > right) return 1 * direction;
    return 0;
  });
  const start = safePage * safeSize;
  const pageRows = rows.slice(start, start + safeSize);
  const items = await Promise.all(pageRows.map((row) => listItem(row, filter, scope.timezone)));
  await recordInstitutionEvent({
    actorUserId: scope.userId,
    actorRole: scope.designation,
    actorEmail: scope.user.email,
    action: "STUDENT_LIST_READ",
    targetType: "STUDENT_ENROLLMENT",
    institutionId: scope.institutionId,
    scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
    details: `rows=${items.length},total=${rows.length}`,
  });
  return {
    items,
    totalElements: rows.length,
    page: safePage,
    size: safeSize,
    totalPages: rows.length === 0 ? 0 : Math.ceil(rows.length / safeSize),
  };
}

export async function listBelowSkillTarget(
  scope: CollegeScope,
  filter: StudentFilter,
  skillId: number,
  page: number,
  size: number,
) {
  if (!Number.isSafeInteger(skillId) || skillId < 1) throw AppError.badRequest("A valid skill id is required");
  const cohort = await loadCohort(scope, { ...filter, assessmentCompleted: null, readinessEvaluated: null });
  if (cohort.length > 5000) {
    throw AppError.badRequest("This skill drill-down exceeds 5,000 students; narrow the cohort filters");
  }
  const matching: CohortRow[] = [];
  for (const row of cohort) {
    if (row.enrollment.status !== "ACTIVE") continue;
    const readiness = await getStudentReadiness(row.userId);
    if (readiness.readinessPercent == null) continue;
    if (readiness.gaps.some((gap) => gap.skillId === skillId && gap.assessed && !gap.metTarget)) {
      matching.push(row);
    }
  }
  matching.sort((a, b) => a.profile.fullName.localeCompare(b.profile.fullName, undefined, { sensitivity: "base" }) ||
    a.profile.studentId.localeCompare(b.profile.studentId));
  const safePage = Math.max(0, page);
  const safeSize = Math.min(Math.max(1, size), 100);
  const start = safePage * safeSize;
  const pageRows = matching.slice(start, start + safeSize);
  const items = await Promise.all(pageRows.map((row) => listItem(row, filter, scope.timezone)));
  await recordInstitutionEvent({
    actorUserId: scope.userId,
    actorRole: scope.designation,
    actorEmail: scope.user.email,
    action: "SKILL_GAP_STUDENT_DRILLDOWN",
    targetType: "SKILL",
    targetId: String(skillId),
    institutionId: scope.institutionId,
    scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
    details: `students=${matching.length}`,
  });
  return {
    items,
    totalElements: matching.length,
    page: safePage,
    size: safeSize,
    totalPages: matching.length === 0 ? 0 : Math.ceil(matching.length / safeSize),
  };
}

export async function requireEnrollment(
  scope: CollegeScope,
  enrollmentId: number | null | undefined,
): Promise<CohortRow> {
  if (enrollmentId == null) throw AppError.notFound("Student enrollment not found");
  const rows = await loadCohort(scope, {});
  const row = rows.find((item) => item.enrollment._id === enrollmentId);
  if (!row) throw AppError.notFound("Student enrollment not found");
  return row;
}

export async function getStudentDetail(scope: CollegeScope, enrollmentId: number) {
  const row = await requireEnrollment(scope, enrollmentId);
  const [readiness, history, roadmap, projects] = await Promise.all([
    getStudentReadiness(row.userId),
    getAttemptHistory(row.userId),
    getMyRoadmap(row.userId),
    getRecommendedProjects(row.userId),
  ]);
  await recordInstitutionEvent({
    actorUserId: scope.userId,
    actorRole: scope.designation,
    actorEmail: scope.user.email,
    action: "STUDENT_VIEW_360",
    targetType: "STUDENT_ENROLLMENT",
    targetId: String(row.enrollment._id),
    institutionId: scope.institutionId,
    scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
    details: `studentProfileId=${row.profile._id}`,
  });
  return {
    profile: profileResponse(row),
    enrollment: { ...toEnrollmentResponse(row), institutionName: scope.institutionName },
    readiness,
    assessmentHistory: history,
    roadmap,
    projects,
    cvAnalysis: null,
    linkedInAnalysis: null,
    permissions: {
      canViewSensitiveProfile: false,
      canViewCvAnalysis: false,
      canViewReports: scope.designation !== "FACULTY",
      canExport: scope.designation !== "FACULTY",
    },
    generatedAt: new Date(),
  };
}

export async function updateEnrollmentStatus(
  scope: CollegeScope,
  enrollmentId: number,
  status: EnrollmentStatus | undefined,
) {
  if (!status) throw AppError.badRequest("Enrollment status is required");
  const row = await requireEnrollment(scope, enrollmentId);
  return withTransaction(async (session) => {
    const updated = await StudentEnrollment.findOneAndUpdate(
      { _id: row.enrollment._id, institutionId: scope.institutionId },
      { $set: { status } },
      { returnDocument: "after", session },
    ).lean();
    if (!updated) throw AppError.notFound("Student enrollment not found");
    await recordInstitutionEvent({
      actorUserId: scope.userId,
      actorRole: scope.designation,
      actorEmail: scope.user.email,
      action: "STUDENT_STATUS_UPDATE",
      targetType: "STUDENT_ENROLLMENT",
      targetId: String(updated._id),
      institutionId: scope.institutionId,
      scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
      details: `from=${row.enrollment.status},to=${updated.status}`,
      session,
    });
    return {
      enrollmentId: updated._id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  });
}

function ensureScopeAllows(
  scope: CollegeScope,
  kind: "department" | "program" | "batch" | "section",
  id: number,
) {
  if (kind === "department" && scope.scopeType === "DEPARTMENT" && scope.scopeId !== id) {
    throw AppError.notFound("Department not found in this institution");
  }
  if (kind === "program" && scope.scopeType === "PROGRAM" && scope.scopeId !== id) {
    throw AppError.notFound("Program not found in this institution");
  }
  if (kind === "batch" && scope.scopeType === "BATCH" && scope.scopeId !== id) {
    throw AppError.notFound("Batch not found in this institution");
  }
  if (kind === "section" && scope.scopeType === "SECTION" && scope.scopeId !== id) {
    throw AppError.notFound("Section not found in this institution");
  }
}

export async function validateFilters(scope: CollegeScope, filter: StudentFilter): Promise<void> {
  if (filter.assessmentDateFrom && filter.assessmentDateTo && filter.assessmentDateFrom > filter.assessmentDateTo) {
    throw AppError.badRequest("Assessment submission start date must be on or before end date");
  }
  if (filter.departmentId != null) {
    await requireDepartment(scope.institutionId, filter.departmentId);
    ensureScopeAllows(scope, "department", filter.departmentId);
  }
  if (filter.programId != null) {
    const program = await requireProgram(scope.institutionId, filter.programId);
    ensureScopeAllows(scope, "program", filter.programId);
    if (scope.scopeType === "DEPARTMENT" && scope.scopeId !== program.departmentId) {
      throw AppError.notFound("Program not found in this institution");
    }
  }
  if (filter.batchId != null) {
    const batch = await requireBatch(scope.institutionId, filter.batchId);
    ensureScopeAllows(scope, "batch", filter.batchId);
    if (scope.scopeType === "PROGRAM" && scope.scopeId !== batch.programId) {
      throw AppError.notFound("Batch not found in this institution");
    }
    if (scope.scopeType === "DEPARTMENT") {
      const program = await requireProgram(scope.institutionId, batch.programId);
      if (scope.scopeId !== program.departmentId) throw AppError.notFound("Batch not found in this institution");
    }
  }
  if (filter.sectionId != null) {
    const section = await requireSection(scope.institutionId, filter.sectionId);
    ensureScopeAllows(scope, "section", filter.sectionId);
    const batch = await requireBatch(scope.institutionId, section.batchId);
    if (scope.scopeType === "BATCH" && scope.scopeId !== batch._id) {
      throw AppError.notFound("Section not found in this institution");
    }
    if (scope.scopeType === "PROGRAM") {
      const program = await requireProgram(scope.institutionId, batch.programId);
      if (scope.scopeId !== program._id) throw AppError.notFound("Section not found in this institution");
    }
    if (scope.scopeType === "DEPARTMENT") {
      const program = await requireProgram(scope.institutionId, batch.programId);
      if (scope.scopeId !== program.departmentId) throw AppError.notFound("Section not found in this institution");
    }
  }
  if (filter.academicYearId != null) {
    await requireAcademicYear(scope.institutionId, filter.academicYearId);
  }
}

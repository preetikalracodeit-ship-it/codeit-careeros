import { AppError } from "../../lib/errors.js";
import { withTransaction } from "../../lib/db.js";
import { getNextSequence } from "../../models/Counter.js";
import { ImprovementPlan, type ImprovementPlanDoc, type PlanStatus } from "../../models/ImprovementPlan.js";
import {
  ImprovementTask,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ImprovementTaskDoc,
  type TaskPriority,
  type TaskStatus,
} from "../../models/ImprovementTask.js";
import { InstitutionMembership } from "../../models/InstitutionMembership.js";
import { Skill } from "../../models/Skill.js";
import { StudentEnrollment } from "../../models/StudentEnrollment.js";
import { User } from "../../models/User.js";
import { recordInstitutionEvent } from "../../lib/audit.js";
import { getStudentReadiness } from "../students/readiness.service.js";
import {
  requireManageImprovementPlans,
  type CollegeScope,
} from "./collegeScope.service.js";
import {
  loadCohort,
  requireEnrollment,
  type CohortRow,
} from "./studentEnrollment.service.js";

const MAX_GENERATED_TASKS = 8;
const MAX_LIST_RESULTS = 500;

export interface PlanTaskInput {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  targetDate?: string | null;
  skillId?: number | null;
  skillName?: string | null;
  baselineScore?: number | null;
  targetScore?: number | null;
  evidenceSource?: string | null;
  ownerUserId?: number | null;
  ownerName?: string | null;
}

export interface PlanCreateInput {
  enrollmentId: number;
  title: string;
  summary?: string | null;
  tasks?: PlanTaskInput[];
}

export interface PlanUpdateInput {
  title?: string;
  summary?: string | null;
  status?: PlanStatus;
}

export interface PlanTaskUpdateInput {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  targetDate?: string | null;
  ownerName?: string | null;
  baselineScore?: number | null;
  targetScore?: number | null;
}

interface PreparedTask extends PlanTaskInput {
  priority: TaskPriority;
  ownerUserId: number;
  ownerName: string;
  skillName: string | null;
}

function isoDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function dateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function taskResponse(task: ImprovementTaskDoc) {
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = isoDate(task.targetDate);
  const overdue = Boolean(
    targetDate
      && targetDate < today
      && task.status !== "COMPLETED"
      && task.status !== "REASSESSMENT_REQUIRED",
  );
  return {
    id: task._id,
    title: task.title,
    description: task.description ?? null,
    skillId: task.skillId ?? null,
    skillName: task.skillName ?? null,
    priority: task.priority,
    status: overdue ? "OVERDUE" : task.status,
    targetDate,
    ownerUserId: task.ownerUserId ?? null,
    ownerName: task.ownerName ?? null,
    baselineScore: task.baselineScore ?? null,
    targetScore: task.targetScore ?? null,
    evidenceSource: task.evidenceSource ?? null,
    overdue,
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

async function planResponse(plan: ImprovementPlanDoc, row: CohortRow) {
  const [tasks, readiness] = await Promise.all([
    ImprovementTask.find({ planId: plan._id })
      .sort({ targetDate: 1, _id: 1 })
      .lean<ImprovementTaskDoc[]>(),
    getStudentReadiness(row.userId),
  ]);
  const taskRows = tasks.map(taskResponse);
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const total = tasks.length;

  return {
    id: plan._id,
    studentEnrollmentId: row.enrollment._id,
    studentProfileId: row.profile._id,
    studentName: row.profile.fullName,
    studentId: row.profile.studentId,
    rollNumber: row.enrollment.rollNumber,
    departmentName: row.department.name,
    programName: row.program.name,
    batchLabel: row.batch.label,
    title: plan.title,
    summary: plan.summary ?? null,
    status: plan.status,
    targetCareerId: plan.targetCareerId ?? null,
    targetCareerName: plan.targetCareerName ?? null,
    currentReadinessPercent: readiness.hasTarget ? readiness.readinessPercent : null,
    createdByName: plan.createdByName ?? null,
    progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    completedTasks: completed,
    totalTasks: total,
    tasks: taskRows,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

async function requireScopedPlan(scope: CollegeScope, id: number) {
  const plan = await ImprovementPlan.findById(id).lean<ImprovementPlanDoc>();
  if (!plan) throw AppError.notFound("Improvement plan not found");
  const enrollment = await StudentEnrollment.findOne({ studentProfileId: plan.studentProfileId })
    .select("_id")
    .lean();
  if (!enrollment) throw AppError.notFound("Improvement plan not found");
  const row = await requireEnrollment(scope, enrollment._id);
  return { plan, row };
}

async function prepareTask(scope: CollegeScope, input: PlanTaskInput): Promise<PreparedTask> {
  const priority = input.priority ?? "MEDIUM";
  if (!(TASK_PRIORITIES as readonly string[]).includes(priority)) {
    throw AppError.badRequest("Task priority is invalid");
  }
  const ownerUserId = input.ownerUserId ?? scope.userId;
  const membership = await InstitutionMembership.findOne({
    userId: ownerUserId,
    institutionId: scope.institutionId,
    status: "ACTIVE",
  }).lean();
  if (!membership) throw AppError.badRequest("The task owner is not active staff in this institution");
  const owner = await User.findById(ownerUserId).select("fullName").lean();
  if (!owner) throw AppError.badRequest("The task owner was not found");

  const skill = input.skillId == null ? null : await Skill.findById(input.skillId).lean();
  if (input.skillId != null && !skill) throw AppError.badRequest("Unknown skill id");

  return {
    ...input,
    priority,
    ownerUserId,
    ownerName: input.ownerName?.trim() || owner.fullName,
    skillName: skill?.name ?? input.skillName ?? null,
  };
}

async function insertTask(
  planId: number,
  input: PreparedTask,
  session: import("mongoose").ClientSession,
): Promise<void> {
  await ImprovementTask.create(
    [{
      _id: await getNextSequence("improvement_tasks", session),
      planId,
      title: input.title.trim(),
      description: input.description ?? null,
      skillId: input.skillId ?? null,
      skillName: input.skillName,
      priority: input.priority,
      status: "NOT_STARTED",
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      ownerUserId: input.ownerUserId,
      ownerName: input.ownerName,
      baselineScore: input.baselineScore ?? null,
      targetScore: input.targetScore ?? null,
      evidenceSource: input.evidenceSource ?? "MANUAL",
    }],
    { session },
  );
}

function auditScope(scope: CollegeScope) {
  return {
    actorUserId: scope.userId,
    actorRole: scope.designation,
    actorEmail: scope.user.email,
    institutionId: scope.institutionId,
    scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
  };
}

export async function listPlans(
  scope: CollegeScope,
  studentEnrollmentId?: number,
  status?: PlanStatus,
  search?: string,
) {
  const cohort = await loadCohort(scope);
  const rowByProfile = new Map(
    cohort.map((row) => [row.profile._id, row]),
  );
  const profileIds = cohort
    .filter((row) => studentEnrollmentId == null || row.enrollment._id === studentEnrollmentId)
    .map((row) => row.profile._id);
  if (profileIds.length === 0) return { items: [], total: 0 };

  const plans = await ImprovementPlan.find({
    studentProfileId: { $in: profileIds },
    ...(status ? { status } : {}),
  })
    .sort({ updatedAt: -1 })
    .limit(MAX_LIST_RESULTS)
    .lean<ImprovementPlanDoc[]>();
  const normalizedSearch = search?.trim().toLocaleLowerCase();
  const items = [];
  for (const plan of plans) {
    const row = rowByProfile.get(plan.studentProfileId);
    if (!row) continue;
    if (
      normalizedSearch
      && ![
        row.profile.fullName,
        row.enrollment.rollNumber,
        plan.title,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    ) {
      continue;
    }
    items.push(await planResponse(plan, row));
  }
  return { items, total: items.length };
}

export async function getPlan(scope: CollegeScope, id: number) {
  const { plan, row } = await requireScopedPlan(scope, id);
  return planResponse(plan, row);
}

export async function createPlan(scope: CollegeScope, input: PlanCreateInput) {
  requireManageImprovementPlans(scope);
  const row = await requireEnrollment(scope, input.enrollmentId);
  const tasks = await Promise.all((input.tasks ?? []).map((task) => prepareTask(scope, task)));
  const title = input.title.trim();
  if (!title) throw AppError.badRequest("A plan title is required");

  const planId = await withTransaction(async (session) => {
    const id = await getNextSequence("improvement_plans", session);
    const [plan] = await ImprovementPlan.create(
      [{
        _id: id,
        studentProfileId: row.profile._id,
        userId: row.userId,
        title,
        summary: input.summary?.trim() || null,
        status: tasks.length > 0 ? "ACTIVE" : "DRAFT",
        targetCareerId: row.profile.targetCareerId ?? null,
        targetCareerName: row.profile.targetCareerName ?? null,
        createdByName: scope.user.fullName,
      }],
      { session },
    );
    for (const task of tasks) await insertTask(id, task, session);
    await recordInstitutionEvent({
      ...auditScope(scope),
      action: "IMPROVEMENT_PLAN_CREATE",
      targetType: "IMPROVEMENT_PLAN",
      targetId: String(id),
      details: `studentEnrollmentId=${row.enrollment._id}`,
      session,
    });
    return plan._id;
  });
  const plan = await ImprovementPlan.findById(planId).lean<ImprovementPlanDoc>();
  if (!plan) throw AppError.internal("Created improvement plan could not be loaded");
  return planResponse(plan, row);
}

export async function generatePlan(
  scope: CollegeScope,
  enrollmentId: number,
  horizonDays?: number | null,
) {
  requireManageImprovementPlans(scope);
  const row = await requireEnrollment(scope, enrollmentId);
  const readiness = await getStudentReadiness(row.userId);
  if (!readiness.hasTarget) {
    throw AppError.badRequest("The student has no target career; a plan cannot be generated from assessment evidence");
  }

  const evidence = readiness.gaps
    .filter((gap) => gap.assessed && gap.scorePercent !== undefined && !gap.metTarget)
    .sort((left, right) => (left.gapPercent ?? 0) - (right.gapPercent ?? 0))
    .slice(0, MAX_GENERATED_TASKS);
  if (evidence.length === 0) {
    throw AppError.badRequest(
      "No assessed skill gaps are available. Missing assessment data is not treated as a gap.",
    );
  }

  const horizon = horizonDays == null ? 30 : Math.max(7, Math.min(180, horizonDays));
  const targetDate = new Date(`${dateInTimezone(new Date(), scope.timezone)}T00:00:00.000Z`);
  targetDate.setUTCDate(targetDate.getUTCDate() + horizon);
  const dueDates = evidence.map((_gap, index) => {
    const date = new Date(targetDate);
    date.setUTCDate(date.getUTCDate() + index * 3);
    return date.toISOString().slice(0, 10);
  });
  const generatedTasks = await Promise.all(evidence.map((gap, index) => {
    const gapPercent = gap.gapPercent ?? 0;
    const priority: TaskPriority = gapPercent <= -30
      ? "HIGH"
      : gapPercent <= -15 ? "MEDIUM" : "LOW";
    return prepareTask(scope, {
      title: `Reach ${gap.targetPercent}% in ${gap.skillName}`,
      description: `Latest assessed score: ${gap.scorePercent}%. Target career requirement: ${gap.targetPercent}%. Practise this skill and reassess when ready.`,
      priority,
      targetDate: dueDates[index],
      skillId: gap.skillId,
      skillName: gap.skillName,
      baselineScore: gap.scorePercent,
      targetScore: gap.targetPercent,
      evidenceSource: "ASSESSMENT",
    });
  }));
  const title = `Readiness plan - ${readiness.targetCareerName}`;
  const summary = "Generated from the latest submitted assessment scores against the target career. Only assessed skills below target are included.";

  const planId = await withTransaction(async (session) => {
    const id = await getNextSequence("improvement_plans", session);
    await ImprovementPlan.create(
      [{
        _id: id,
        studentProfileId: row.profile._id,
        userId: row.userId,
        title,
        summary,
        status: "ACTIVE",
        targetCareerId: readiness.targetCareerId,
        targetCareerName: readiness.targetCareerName,
        createdByName: scope.user.fullName,
      }],
      { session },
    );
    for (const task of generatedTasks) await insertTask(id, task, session);
    await recordInstitutionEvent({
      ...auditScope(scope),
      action: "IMPROVEMENT_PLAN_GENERATE",
      targetType: "IMPROVEMENT_PLAN",
      targetId: String(id),
      details: `studentEnrollmentId=${row.enrollment._id},tasks=${generatedTasks.length}`,
      session,
    });
    return id;
  });
  const plan = await ImprovementPlan.findById(planId).lean<ImprovementPlanDoc>();
  if (!plan) throw AppError.internal("Generated improvement plan could not be loaded");
  return planResponse(plan, row);
}

export async function updatePlan(scope: CollegeScope, id: number, input: PlanUpdateInput) {
  requireManageImprovementPlans(scope);
  const { row } = await requireScopedPlan(scope, id);
  await withTransaction(async (session) => {
    const plan = await ImprovementPlan.findById(id).session(session);
    if (!plan) throw AppError.notFound("Improvement plan not found");
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw AppError.badRequest("A plan title cannot be blank");
      plan.title = title;
    }
    if (input.summary !== undefined) plan.summary = input.summary?.trim() || null;
    if (input.status !== undefined) plan.status = input.status;
    await plan.save({ session });
    await recordInstitutionEvent({
      ...auditScope(scope),
      action: "IMPROVEMENT_PLAN_UPDATE",
      targetType: "IMPROVEMENT_PLAN",
      targetId: String(id),
      details: `status=${plan.status}`,
      session,
    });
  });
  const plan = await ImprovementPlan.findById(id).lean<ImprovementPlanDoc>();
  if (!plan) throw AppError.notFound("Improvement plan not found");
  return planResponse(plan, row);
}

export async function addTask(scope: CollegeScope, planId: number, input: PlanTaskInput) {
  requireManageImprovementPlans(scope);
  const { row } = await requireScopedPlan(scope, planId);
  const task = await prepareTask(scope, input);
  await withTransaction(async (session) => {
    const plan = await ImprovementPlan.findById(planId).session(session);
    if (!plan) throw AppError.notFound("Improvement plan not found");
    await insertTask(planId, task, session);
    if (plan.status === "DRAFT") plan.status = "ACTIVE";
    await plan.save({ session });
    await recordInstitutionEvent({
      ...auditScope(scope),
      action: "IMPROVEMENT_TASK_ADD",
      targetType: "IMPROVEMENT_TASK",
      targetId: String(planId),
      details: `title=${task.title}`,
      session,
    });
  });
  const plan = await ImprovementPlan.findById(planId).lean<ImprovementPlanDoc>();
  if (!plan) throw AppError.notFound("Improvement plan not found");
  return planResponse(plan, row);
}

async function refreshPlanStatus(
  plan: { status: PlanStatus; save: (options?: { session?: import("mongoose").ClientSession }) => Promise<unknown> },
  planId: number,
  session: import("mongoose").ClientSession,
): Promise<void> {
  const tasks = await ImprovementTask.find({ planId }).session(session).select("status").lean();
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  if (tasks.length > 0 && completed === tasks.length && plan.status === "ACTIVE") {
    plan.status = "COMPLETED";
    await plan.save({ session });
  } else if (completed < tasks.length && plan.status === "COMPLETED") {
    plan.status = "ACTIVE";
    await plan.save({ session });
  }
}

export async function updateTask(
  scope: CollegeScope,
  planId: number,
  taskId: number,
  input: PlanTaskUpdateInput,
) {
  requireManageImprovementPlans(scope);
  const { row } = await requireScopedPlan(scope, planId);
  await withTransaction(async (session) => {
    const plan = await ImprovementPlan.findById(planId).session(session);
    if (!plan) throw AppError.notFound("Improvement plan not found");
    const task = await ImprovementTask.findOne({ _id: taskId, planId }).session(session);
    if (!task) throw AppError.notFound("Improvement task not found");
    if (input.title !== undefined) task.title = input.title.trim();
    if (input.description !== undefined) task.description = input.description;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.status !== undefined) {
      if (!(TASK_STATUSES as readonly string[]).includes(input.status)) {
        throw AppError.badRequest("Task status is invalid");
      }
      task.status = input.status;
      task.completedAt = input.status === "COMPLETED" ? new Date() : null;
    }
    if (input.targetDate !== undefined) {
      task.targetDate = input.targetDate ? new Date(input.targetDate) : null;
    }
    if (input.ownerName !== undefined) task.ownerName = input.ownerName?.trim() || null;
    if (input.baselineScore !== undefined) task.baselineScore = input.baselineScore;
    if (input.targetScore !== undefined) task.targetScore = input.targetScore;
    await task.save({ session });
    await refreshPlanStatus(plan, planId, session);
    await recordInstitutionEvent({
      ...auditScope(scope),
      action: "IMPROVEMENT_TASK_UPDATE",
      targetType: "IMPROVEMENT_TASK",
      targetId: String(taskId),
      details: `planId=${planId},status=${task.status}`,
      session,
    });
  });
  const plan = await ImprovementPlan.findById(planId).lean<ImprovementPlanDoc>();
  if (!plan) throw AppError.notFound("Improvement plan not found");
  return planResponse(plan, row);
}

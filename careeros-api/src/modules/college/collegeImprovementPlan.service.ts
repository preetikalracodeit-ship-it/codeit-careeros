import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import { ImprovementPlan, type ImprovementPlanDoc } from "../../models/ImprovementPlan.js";
import { ImprovementTask, type ImprovementTaskDoc } from "../../models/ImprovementTask.js";
import { StudentProfile, type StudentProfileDoc } from "../../models/StudentProfile.js";
import { type CollegeScope } from "./collegeScope.service.js";
import { recordInstitutionEvent } from "../../lib/audit.js";
export interface PlanTaskInput {
  title: string;
  description?: string | null;
  priority?: string;
  targetDate?: string | null;
  skillId?: number | null;
  skillName?: string | null;
  baselineScore?: number | null;
  targetScore?: number | null;
  evidenceSource?: string | null;
  ownerName?: string | null;
}

export interface PlanCreateInput {
  enrollmentId: number;
  title: string;
  summary?: string | null;
  targetCareerId?: number | null;
  targetCareerName?: string | null;
  tasks?: PlanTaskInput[];
}

export interface PlanUpdateInput {
  title?: string;
  summary?: string | null;
  status?: string;
}

function taskResponse(task: ImprovementTaskDoc) {
  const today = Date.now();
  const overdue = task.targetDate && task.status !== "COMPLETED" && task.status !== "REASSESSMENT_REQUIRED"
    ? new Date(task.targetDate).getTime() < today
    : false;
  return {
    id: task._id,
    title: task.title,
    description: task.description ?? null,
    skillId: task.skillId ?? null,
    skillName: task.skillName ?? null,
    priority: task.priority,
    status: overdue ? "OVERDUE" : task.status,
    targetDate: task.targetDate ?? null,
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

async function planResponse(plan: ImprovementPlanDoc) {
  const profile = await StudentProfile.findById(plan.studentProfileId).lean<StudentProfileDoc>();
  const tasks = await ImprovementTask.find({ planId: plan._id }).sort({ targetDate: 1, _id: 1 }).lean<ImprovementTaskDoc[]>();
  const taskRows = tasks.map((t) => taskResponse(t));
  const completed = taskRows.filter((t) => t.status === "COMPLETED").length;
  const total = taskRows.length;
  return {
    id: plan._id,
    studentProfileId: plan.studentProfileId,
    studentName: profile?.fullName ?? "Unknown",
    title: plan.title,
    summary: plan.summary ?? null,
    status: plan.status,
    targetCareerId: plan.targetCareerId ?? null,
    targetCareerName: plan.targetCareerName ?? null,
    createdByName: plan.createdByName ?? null,
    progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    completedTasks: completed,
    totalTasks: total,
    tasks: taskRows,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}


export interface PlanTaskUpdateInput {
  title?: string;
  description?: string | null;
  priority?: string;
  status?: string;
  targetDate?: string | null;
  ownerName?: string | null;
  baselineScore?: number | null;
  targetScore?: number | null;
}
export async function listPlans(scope: CollegeScope, studentEnrollmentId?: number | null, status?: string | null, search?: string | null) {
  const filter: Record<string, unknown> = {};
  if (studentEnrollmentId) filter.studentProfileId = studentEnrollmentId;
  if (status) filter.status = status;
  const plans = await ImprovementPlan.find(filter).sort({ updatedAt: -1 }).lean<ImprovementPlanDoc[]>();
  const result = [];
  for (const plan of plans) {
    const profile = await StudentProfile.findById(plan.studentProfileId).lean<StudentProfileDoc>();
    if (!profile) continue;
    if (search && !profile.fullName.toLowerCase().includes(search.toLowerCase())) continue;
    const row = await planResponse(plan);
    result.push(row);
  }
  return result;
}
export async function getPlan(scope: CollegeScope, id: number) {
  const plan = await ImprovementPlan.findById(id).lean<ImprovementPlanDoc>();
  if (!plan) throw AppError.notFound("Improvement plan not found");
  return planResponse(plan);
}

export async function createPlan(scope: CollegeScope, input: PlanCreateInput) {
  const profile = await StudentProfile.findById(input.enrollmentId).lean<StudentProfileDoc>();
  if (!profile) throw AppError.notFound("Student not found");
  const [plan] = await ImprovementPlan.create([{
    _id: await getNextSequence("improvement_plans"),
    studentProfileId: input.enrollmentId,
    userId: profile.userId,
    title: input.title,
    summary: input.summary ?? null,
    status: "ACTIVE",
    targetCareerId: input.targetCareerId ?? null,
    targetCareerName: input.targetCareerName ?? null,
    createdByName: scope.user.fullName,
  }]);
  if (input.tasks && input.tasks.length > 0) {
    for (const task of input.tasks) {
      await (ImprovementTask.create as any)([{
        _id: await getNextSequence("improvement_tasks"),
        planId: plan._id,
        title: task.title,
        description: task.description ?? null,
        skillId: task.skillId ?? null,
        skillName: task.skillName ?? null,
        priority: task.priority ?? "MEDIUM",
        status: "NOT_STARTED",
        targetDate: task.targetDate ? new Date(task.targetDate) : null,
        ownerName: task.ownerName ?? null,
        baselineScore: task.baselineScore ?? null,
        targetScore: task.targetScore ?? null,
        evidenceSource: task.evidenceSource ?? null,
      }]);
    }
  }
  await recordInstitutionEvent({ action: "IMPROVEMENT_PLAN_CREATE", targetType: "IMPROVEMENT_PLAN", targetId: String(plan._id), institutionId: scope.institutionId, details: `title=${input.title}` });
  return planResponse(plan);
}

export async function updatePlan(scope: CollegeScope, id: number, input: PlanUpdateInput) {
  const plan = await ImprovementPlan.findById(id);
  if (!plan) throw AppError.notFound("Improvement plan not found");
  if (input.title !== undefined) plan.title = input.title;
  if (input.summary !== undefined) plan.summary = input.summary;
  if (input.status !== undefined) plan.status = input.status as any;
  await plan.save();
  await recordInstitutionEvent({ action: "IMPROVEMENT_PLAN_UPDATE", targetType: "IMPROVEMENT_PLAN", targetId: String(id), institutionId: scope.institutionId, details: `status=${input.status}` });
  return planResponse(plan);
}

export async function addTask(scope: CollegeScope, planId: number, input: PlanTaskInput) {
  const plan = await ImprovementPlan.findById(planId);
  if (!plan) throw AppError.notFound("Improvement plan not found");
  await (ImprovementTask.create as any)([{
    _id: await getNextSequence("improvement_tasks"),
    planId,
    title: input.title,
    description: input.description ?? null,
    skillId: input.skillId ?? null,
    skillName: input.skillName ?? null,
    priority: input.priority ?? "MEDIUM",
    status: "NOT_STARTED",
    targetDate: input.targetDate ? new Date(input.targetDate) : null,
    ownerName: input.ownerName ?? null,
    baselineScore: input.baselineScore ?? null,
    targetScore: input.targetScore ?? null,
    evidenceSource: input.evidenceSource ?? null,
  }]);
  await recordInstitutionEvent({ action: "IMPROVEMENT_TASK_ADD", targetType: "IMPROVEMENT_TASK", targetId: String(planId), institutionId: scope.institutionId, details: `title=${input.title}` });
  return planResponse(plan);
}

export async function updateTask(scope: CollegeScope, planId: number, taskId: number, input: PlanTaskUpdateInput) {
  const plan = await ImprovementPlan.findById(planId);
  if (!plan) throw AppError.notFound("Improvement plan not found");
  const task = await ImprovementTask.findOne({ _id: taskId, planId });
  if (!task) throw AppError.notFound("Improvement task not found");
  if (input.title !== undefined) task.title = input.title;
  if (input.description !== undefined) task.description = input.description;
  if (input.priority !== undefined) task.priority = input.priority as any;
  if (input.status !== undefined) {
    task.status = input.status as any;
    if (input.status === "COMPLETED") task.completedAt = new Date();
  }
  if (input.targetDate !== undefined) task.targetDate = input.targetDate ? new Date(input.targetDate) : null;
  if (input.ownerName !== undefined) task.ownerName = input.ownerName;
  if (input.baselineScore !== undefined) task.baselineScore = input.baselineScore;
  if (input.targetScore !== undefined) task.targetScore = input.targetScore;
  await task.save();
  await recordInstitutionEvent({ action: "IMPROVEMENT_TASK_UPDATE", targetType: "IMPROVEMENT_TASK", targetId: String(taskId), institutionId: scope.institutionId, details: `status=${input.status}` });
  return planResponse(plan);
}


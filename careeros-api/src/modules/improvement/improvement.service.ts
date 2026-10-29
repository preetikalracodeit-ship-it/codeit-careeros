import { AppError } from "../../lib/errors.js";
import { ImprovementPlan, type ImprovementPlanDoc } from "../../models/ImprovementPlan.js";
import { ImprovementTask, type ImprovementTaskDoc, type TaskStatus } from "../../models/ImprovementTask.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { getStudentReadiness } from "../students/readiness.service.js";
import type { UpdateTaskInput } from "./improvement.schemas.js";

type ProfileLike = { fullName: string; studentId: string; branch?: string | null; degree?: string | null };
type ReadinessLike = { hasTarget: boolean; readinessPercent: number };

function isOverdue(task: ImprovementTaskDoc, today: number): boolean {
  if (!task.targetDate) return false;
  if (task.status === "COMPLETED" || task.status === "REASSESSMENT_REQUIRED") return false;
  return new Date(task.targetDate).getTime() < today;
}

function taskResponse(task: ImprovementTaskDoc, today: number) {
  const overdue = isOverdue(task, today);
  return {
    id: task._id,
    title: task.title,
    description: task.description ?? null,
    skillId: task.skillId ?? null,
    skillName: task.skillName ?? null,
    priority: task.priority,
    status: overdue ? "OVERDUE" : task.status,
    targetDate: task.targetDate ?? null,
    ownerUserId: null,
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

async function planResponse(plan: ImprovementPlanDoc, profile: ProfileLike, readiness?: ReadinessLike) {
  const today = Date.now();
  const tasks = await ImprovementTask.find({ planId: plan._id }).sort({ targetDate: 1, _id: 1 }).lean();
  const taskRows = tasks.map((task) => taskResponse(task as ImprovementTaskDoc, today));
  const completed = taskRows.filter((task) => task.status === "COMPLETED").length;
  const total = taskRows.length;
  return {
    id: plan._id,
    studentEnrollmentId: null,
    studentProfileId: plan.studentProfileId,
    studentName: profile.fullName,
    studentId: profile.studentId,
    rollNumber: null,
    departmentName: profile.branch ?? null,
    programName: profile.degree ?? null,
    batchLabel: null,
    title: plan.title,
    summary: plan.summary ?? null,
    status: plan.status,
    targetCareerName: plan.targetCareerName ?? null,
    currentReadinessPercent: readiness?.hasTarget ? readiness.readinessPercent : null,
    createdByName: plan.createdByName ?? null,
    tasks: taskRows,
    completedTasks: completed,
    totalTasks: total,
    progressPercent: total === 0 ? 0 : Math.round((completed * 100) / total),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export async function getMyImprovementPlans(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile) throw AppError.notFound("Student profile not found");
  const plans = await ImprovementPlan.find({ studentProfileId: profile._id }).sort({ updatedAt: -1 }).lean();
  const readiness = plans.length > 0 ? await getStudentReadiness(userId) : undefined;
  const items = await Promise.all(plans.map((plan) => planResponse(plan as ImprovementPlanDoc, profile, readiness)));
  return { items, total: items.length };
}

export async function updateMyTask(userId: number, taskId: number, input: UpdateTaskInput) {
  if (!["NOT_STARTED", "IN_PROGRESS", "COMPLETED"].includes(input.status)) {
    throw AppError.badRequest("That task status can only be set by institution staff");
  }
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile) throw AppError.notFound("Student profile not found");
  const task = await ImprovementTask.findById(taskId);
  if (!task) throw AppError.notFound("Improvement task not found");
  const plan = await ImprovementPlan.findById(task.planId);
  if (!plan || plan.studentProfileId !== profile._id) {
    throw AppError.notFound("Improvement task not found");
  }

  task.status = input.status as TaskStatus;
  task.completedAt = input.status === "COMPLETED" ? new Date() : null;
  await task.save();

  const tasks = await ImprovementTask.find({ planId: plan._id }).lean();
  const completed = tasks.filter((row) => row.status === "COMPLETED").length;
  if (tasks.length > 0 && completed === tasks.length && plan.status === "ACTIVE") {
    plan.status = "COMPLETED";
    await plan.save();
  } else if (completed < tasks.length && plan.status === "COMPLETED") {
    plan.status = "ACTIVE";
    await plan.save();
  }

  const readiness = await getStudentReadiness(userId);
  return planResponse(plan.toObject() as ImprovementPlanDoc, profile, readiness);
}

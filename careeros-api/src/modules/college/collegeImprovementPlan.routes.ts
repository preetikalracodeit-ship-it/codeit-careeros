import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { AppError } from "../../lib/errors.js";
import { validate } from "../../lib/validators.js";
import { z } from "zod";
import { requireCollegeScope } from "./collegeScope.service.js";
import { PLAN_STATUSES } from "../../models/ImprovementPlan.js";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../models/ImprovementTask.js";
import {
  listPlans,
  getPlan,
  createPlan,
  generatePlan,
  updatePlan,
  addTask,
  updateTask,
} from "./collegeImprovementPlan.service.js";

const localDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid date");

const planCreateSchema = z.object({
  enrollmentId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(160),
  summary: z.string().max(1000).optional().nullable(),
  tasks: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    targetDate: localDateSchema.optional().nullable(),
    ownerUserId: z.coerce.number().int().positive().optional().nullable(),
    skillId: z.coerce.number().int().positive().optional().nullable(),
    baselineScore: z.coerce.number().min(0).max(100).optional().nullable(),
    targetScore: z.coerce.number().min(0).max(100).optional().nullable(),
    ownerName: z.string().max(120).optional().nullable(),
  })).optional(),
});

const planUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(1000).optional().nullable(),
  status: z.enum(PLAN_STATUSES).optional(),
});

const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  targetDate: localDateSchema.optional().nullable(),
  skillId: z.coerce.number().int().positive().optional().nullable(),
  ownerUserId: z.coerce.number().int().positive().optional().nullable(),
  baselineScore: z.coerce.number().min(0).max(100).optional().nullable(),
  targetScore: z.coerce.number().min(0).max(100).optional().nullable(),
  ownerName: z.string().max(120).optional().nullable(),
});

const taskUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.string().trim().transform((value) => value.toUpperCase()).pipe(z.enum(TASK_STATUSES)).optional(),
  targetDate: localDateSchema.optional().nullable(),
  ownerName: z.string().max(120).optional().nullable(),
  baselineScore: z.coerce.number().min(0).max(100).optional().nullable(),
  targetScore: z.coerce.number().min(0).max(100).optional().nullable(),
});


export const collegeImprovementPlanRouter = Router();

const planListQuerySchema = z.object({
  studentEnrollmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(PLAN_STATUSES).optional(),
  search: z.string().trim().max(200).optional(),
});

collegeImprovementPlanRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    const query = validate(planListQuerySchema, req.query);
    sendSuccess(res, await listPlans(scope, query.studentEnrollmentId, query.status, query.search));
  } catch (error) {
    next(error);
  }
});

collegeImprovementPlanRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError.notFound("Improvement plan not found");
    sendSuccess(res, await getPlan(scope, id));
  } catch (error) {
    next(error);
  }
});

collegeImprovementPlanRouter.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    const input = validate(z.object({
      enrollmentId: z.coerce.number().int().positive(),
      horizonDays: z.coerce.number().int().positive().optional().nullable(),
    }), req.body);
    sendSuccess(res, await generatePlan(scope, input.enrollmentId, input.horizonDays), {
      message: "Improvement plan generated",
    });
  } catch (error) {
    next(error);
  }
});

collegeImprovementPlanRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    const input = validate(planCreateSchema, req.body);
    sendSuccess(res, await createPlan(scope, input), { message: "Improvement plan created" });
  } catch (error) {
    next(error);
  }
});

collegeImprovementPlanRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError.notFound("Improvement plan not found");
    const input = validate(planUpdateSchema, req.body);
    sendSuccess(res, await updatePlan(scope, id, input), { message: "Improvement plan updated" });
  } catch (error) {
    next(error);
  }
});

collegeImprovementPlanRouter.post("/:id/tasks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw AppError.notFound("Improvement plan not found");
    const input = validate(taskCreateSchema, req.body);
    sendSuccess(res, await addTask(scope, id, input), { message: "Improvement task added" });
  } catch (error) {
    next(error);
  }
});

collegeImprovementPlanRouter.patch("/:id/tasks/:taskId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    const id = Number(req.params.id);
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(id) || id <= 0) throw AppError.notFound("Improvement plan not found");
    if (!Number.isInteger(taskId) || taskId <= 0) throw AppError.notFound("Improvement task not found");
    const input = validate(taskUpdateSchema, req.body);
    sendSuccess(res, await updateTask(scope, id, taskId, input), { message: "Improvement task updated" });
  } catch (error) {
    next(error);
  }
});

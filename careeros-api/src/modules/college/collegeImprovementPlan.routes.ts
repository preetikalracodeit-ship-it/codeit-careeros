import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { AppError } from "../../lib/errors.js";
import { validate } from "../../lib/validators.js";
import { z } from "zod";
import { requireCollegeScope } from "./collegeScope.service.js";
import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  addTask,
  updateTask,
  type PlanCreateInput,
  type PlanUpdateInput,
  type PlanTaskInput,
  type PlanTaskUpdateInput,
} from "./collegeImprovementPlan.service.js";

const planCreateSchema = z.object({
  enrollmentId: z.coerce.number().int().positive(),
  title: z.string().min(1).max(200),
  summary: z.string().max(1000).optional().nullable(),
  targetCareerId: z.coerce.number().int().positive().optional().nullable(),
  targetCareerName: z.string().max(160).optional().nullable(),
  tasks: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    targetDate: z.string().optional().nullable(),
    skillId: z.coerce.number().int().positive().optional().nullable(),
    skillName: z.string().max(120).optional().nullable(),
    baselineScore: z.coerce.number().min(0).max(100).optional().nullable(),
    targetScore: z.coerce.number().min(0).max(100).optional().nullable(),
    evidenceSource: z.string().max(40).optional().nullable(),
    ownerName: z.string().max(120).optional().nullable(),
  })).optional(),
});

const planUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(1000).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});

const taskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  targetDate: z.string().optional().nullable(),
  skillId: z.coerce.number().int().positive().optional().nullable(),
  skillName: z.string().max(120).optional().nullable(),
  baselineScore: z.coerce.number().min(0).max(100).optional().nullable(),
  targetScore: z.coerce.number().min(0).max(100).optional().nullable(),
  evidenceSource: z.string().max(40).optional().nullable(),
  ownerName: z.string().max(120).optional().nullable(),
});

const taskUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  status: z.string().trim().min(1).transform((v) => v.toUpperCase()).optional(),
  targetDate: z.string().optional().nullable(),
  ownerName: z.string().max(120).optional().nullable(),
  baselineScore: z.coerce.number().min(0).max(100).optional().nullable(),
  targetScore: z.coerce.number().min(0).max(100).optional().nullable(),
});


export const collegeImprovementPlanRouter = Router();


collegeImprovementPlanRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    const studentEnrollmentId = req.query.studentEnrollmentId ? Number(req.query.studentEnrollmentId) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const search = req.query.search ? String(req.query.search) : null;
    sendSuccess(res, await listPlans(scope, studentEnrollmentId, status, search));
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
    const input = validate(z.object({ enrollmentId: z.coerce.number().int().positive(), horizonDays: z.coerce.number().int().positive().optional().nullable() }), req.body);
    sendSuccess(res, await createPlan(scope, {
      enrollmentId: input.enrollmentId,
      title: "Generated improvement plan",
      summary: null,
    }), { status: 201 });
  } catch (error) {
    next(error);
  }
});

collegeImprovementPlanRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    const input = validate(planCreateSchema, req.body);
    sendSuccess(res, await createPlan(scope, input as PlanCreateInput), { status: 201 });
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
    sendSuccess(res, await updatePlan(scope, id, input as PlanUpdateInput));
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
    sendSuccess(res, await addTask(scope, id, input as PlanTaskInput));
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
    sendSuccess(res, await updateTask(scope, id, taskId, input as PlanTaskUpdateInput));
  } catch (error) {
    next(error);
  }
});

import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { requireRole } from "../../middleware/auth.js";
import { validate } from "../../lib/validators.js";
import { z } from "zod";
import {
  getAdminMe,
  getAiStatus,
  listCareers,
  getCareer,
  createCareer,
  updateCareer,
  replaceCareerSkills,
  deleteCareer,
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  listAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  listAssessmentQuestions,
  createAssessmentQuestion,
  updateAssessmentQuestion,
  deleteAssessmentQuestion,
  listProjects,
  listRoadmaps,
} from "./adminMaster.service.js";

export const adminMasterRouter = Router();
adminMasterRouter.use(requireRole("SUPER_ADMIN"));

// Admin profile & AI status
adminMasterRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getAdminMe(req.user!.id)); } catch (e) { next(e); }
});

adminMasterRouter.get("/ai/status", async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, getAiStatus()); } catch (e) { next(e); }
});

// Careers & Competency Framework
adminMasterRouter.get("/careers", async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await listCareers()); } catch (e) { next(e); }
});

adminMasterRouter.get("/careers/:id", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getCareer(Number(req.params.id))); } catch (e) { next(e); }
});

adminMasterRouter.post("/careers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(
      z.object({
        name: z.string().min(1).max(140),
        description: z.string().max(1000).optional().nullable(),
        category: z.string().min(1).max(40),
        difficultyLevel: z.string().min(1).max(20),
        published: z.boolean().optional(),
        skills: z.array(z.object({
          skillId: z.coerce.number().int().positive(),
          weightPercent: z.coerce.number().min(0).max(100),
          requiredLevel: z.string().min(1),
          targetPercent: z.coerce.number().min(1).max(100).optional(),
        })).optional(),
      }),
      req.body,
    );
    sendSuccess(res, await createCareer(input), { status: 201 });
  } catch (e) { next(e); }
});

adminMasterRouter.put("/careers/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(
      z.object({
        name: z.string().min(1).max(140).optional(),
        description: z.string().max(1000).optional().nullable(),
        category: z.string().min(1).max(40).optional(),
        difficultyLevel: z.string().min(1).max(20).optional(),
        published: z.boolean().optional(),
        skills: z.array(z.object({
          skillId: z.coerce.number().int().positive(),
          weightPercent: z.coerce.number().min(0).max(100),
          requiredLevel: z.string().min(1),
          targetPercent: z.coerce.number().min(1).max(100).optional(),
        })).optional(),
      }),
      req.body,
    );
    sendSuccess(res, await updateCareer(Number(req.params.id), input));
  } catch (e) { next(e); }
});

adminMasterRouter.put("/careers/:id/skills", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skills = validate(
      z.array(z.object({
        skillId: z.coerce.number().int().positive(),
        weightPercent: z.coerce.number().min(0).max(100),
        requiredLevel: z.string().min(1),
        targetPercent: z.coerce.number().min(1).max(100).optional(),
      })),
      req.body,
    );
    sendSuccess(res, await replaceCareerSkills(Number(req.params.id), skills));
  } catch (e) { next(e); }
});

adminMasterRouter.delete("/careers/:id", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await deleteCareer(Number(req.params.id))); } catch (e) { next(e); }
});

// Skills
adminMasterRouter.get("/skills", async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await listSkills()); } catch (e) { next(e); }
});

adminMasterRouter.get("/skills/:id", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getSkill(Number(req.params.id))); } catch (e) { next(e); }
});

adminMasterRouter.post("/skills", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(
      z.object({
        name: z.string().min(1).max(120),
        category: z.string().min(1).max(40),
        description: z.string().max(300).optional().nullable(),
        active: z.boolean().optional(),
      }),
      req.body,
    );
    sendSuccess(res, await createSkill(input), { status: 201 });
  } catch (e) { next(e); }
});

adminMasterRouter.put("/skills/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(
      z.object({
        name: z.string().min(1).max(120).optional(),
        category: z.string().min(1).max(40).optional(),
        description: z.string().max(300).optional().nullable(),
        active: z.boolean().optional(),
      }),
      req.body,
    );
    sendSuccess(res, await updateSkill(Number(req.params.id), input));
  } catch (e) { next(e); }
});

adminMasterRouter.delete("/skills/:id", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await deleteSkill(Number(req.params.id))); } catch (e) { next(e); }
});

// Assessments
adminMasterRouter.get("/assessments", async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await listAssessments()); } catch (e) { next(e); }
});

adminMasterRouter.get("/assessments/:id", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getAssessment(Number(req.params.id))); } catch (e) { next(e); }
});

adminMasterRouter.post("/assessments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(
      z.object({
        careerId: z.coerce.number().int().positive(),
        title: z.string().min(1).max(150),
        description: z.string().max(500).optional().nullable(),
        durationMinutes: z.coerce.number().int().min(1),
        published: z.boolean().optional(),
      }),
      req.body,
    );
    sendSuccess(res, await createAssessment(input), { status: 201 });
  } catch (e) { next(e); }
});

adminMasterRouter.put("/assessments/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(
      z.object({
        careerId: z.coerce.number().int().positive().optional(),
        title: z.string().min(1).max(150).optional(),
        description: z.string().max(500).optional().nullable(),
        durationMinutes: z.coerce.number().int().min(1).optional(),
        published: z.boolean().optional(),
      }),
      req.body,
    );
    sendSuccess(res, await updateAssessment(Number(req.params.id), input));
  } catch (e) { next(e); }
});

adminMasterRouter.delete("/assessments/:id", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await deleteAssessment(Number(req.params.id))); } catch (e) { next(e); }
});

// Assessment Question Bank
const optionSchema = z.object({
  id: z.coerce.number().int().optional(),
  optionText: z.string().min(1).max(500),
  correct: z.boolean(),
  displayOrder: z.coerce.number().int().optional(),
});

const questionSchema = z.object({
  assessmentId: z.coerce.number().int().positive().optional(),
  skillId: z.coerce.number().int().positive(),
  questionText: z.string().min(1).max(1000),
  difficulty: z.string().min(1).max(20),
  questionType: z.string().max(20).default("MCQ"),
  explanation: z.string().max(600).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).optional().nullable(),
  active: z.boolean().optional(),
  options: z.array(optionSchema).min(2),
});

adminMasterRouter.get("/assessments/:id/questions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listAssessmentQuestions(Number(req.params.id)));
  } catch (e) { next(e); }
});

adminMasterRouter.post("/assessments/:id/questions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(questionSchema, req.body);
    sendSuccess(res, await createAssessmentQuestion(Number(req.params.id), input), { status: 201 });
  } catch (e) { next(e); }
});

adminMasterRouter.put("/questions/:questionId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(questionSchema, req.body);
    sendSuccess(res, await updateAssessmentQuestion(Number(req.params.questionId), input));
  } catch (e) { next(e); }
});

adminMasterRouter.delete("/questions/:questionId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await deleteAssessmentQuestion(Number(req.params.questionId)));
  } catch (e) { next(e); }
});

// Projects & Roadmaps (read-only catalogs for admin)
adminMasterRouter.get("/projects", async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await listProjects()); } catch (e) { next(e); }
});

adminMasterRouter.get("/roadmaps", async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await listRoadmaps()); } catch (e) { next(e); }
});

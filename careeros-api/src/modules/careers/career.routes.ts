import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { validate } from "../../lib/validators.js";
import { requireRole } from "../../middleware/auth.js";
import {
  getPublishedCareer,
  listPublishedCareers,
  listPublishedCareerSkills,
  setStudentTargetCareer,
} from "./career.service.js";
import { careerIdSchema, targetCareerSchema } from "./career.schemas.js";
import { submittedAttemptHistory, studentReadiness } from "../assessments/attempt.service.js";
import { attemptHistoryQuerySchema } from "../assessments/assessment.schemas.js";

export const careerRouter = Router();
export const studentCareerRouter = Router();

async function handle(request: Request, response: Response, next: NextFunction, action: () => Promise<unknown>) {
  try {
    sendSuccess(response, await action());
  } catch (error) {
    next(error);
  }
}

function parseId(raw: string): number {
  const parsed = careerIdSchema.safeParse(raw);
  if (!parsed.success) throw AppError.badRequest("Career id must be a positive integer");
  return parsed.data;
}

careerRouter.get("/", (req, res, next) => handle(req, res, next, listPublishedCareers));
careerRouter.get("/:id/skills", (req, res, next) =>
  handle(req, res, next, () => listPublishedCareerSkills(parseId(req.params.id))),
);
careerRouter.get("/:id", (req, res, next) =>
  handle(req, res, next, () => getPublishedCareer(parseId(req.params.id))),
);

studentCareerRouter.use(requireRole("STUDENT"));
studentCareerRouter.put("/me/career", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(targetCareerSchema, req.body);
    const result = await setStudentTargetCareer(req.user!.id, req.user!.email, input.careerId);
    sendSuccess(res, result, { message: "Target career updated" });
  } catch (error) {
    next(error);
  }
});

studentCareerRouter.get("/me/attempts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = attemptHistoryQuerySchema.safeParse(req.query);
    if (!parsed.success) throw AppError.badRequest("assessmentId must be a positive integer");
    sendSuccess(res, await submittedAttemptHistory(req.user!.id, parsed.data.assessmentId));
  } catch (error) { next(error); }
});

studentCareerRouter.get("/me/readiness", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await studentReadiness(req.user!.id)); }
  catch (error) { next(error); }
});

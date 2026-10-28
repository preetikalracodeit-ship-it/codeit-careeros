import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { requireRole } from "../../middleware/auth.js";
import { validate } from "../../lib/validators.js";
import { careerIdSchema } from "../careers/career.schemas.js";
import { listPublishedAssessmentsForCareer } from "./assessment.service.js";
import { answerSchema, assessmentIdSchema, myAttemptQuerySchema } from "./assessment.schemas.js";
import { getAssessmentAttemptState, latestAssessmentAttempt, saveAssessmentAnswer, startOrResumeAssessment, submitAssessmentAttempt } from "./attempt.service.js";

export const assessmentRouter = Router();
assessmentRouter.use(requireRole("STUDENT"));

assessmentRouter.get("/:careerId/available", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = careerIdSchema.safeParse(req.params.careerId);
    if (!parsed.success) throw AppError.badRequest("Career id must be a positive integer");
    const data = await listPublishedAssessmentsForCareer(parsed.data);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

function parseId(value: string): number {
  const parsed = assessmentIdSchema.safeParse(value);
  if (!parsed.success) throw AppError.badRequest("Id must be a positive integer");
  return parsed.data;
}

assessmentRouter.post("/:assessmentId/start", async (req, res, next) => {
  try { sendSuccess(res, await startOrResumeAssessment(parseId(req.params.assessmentId), req.user!.id)); }
  catch (error) { next(error); }
});

assessmentRouter.get("/attempts/my", async (req, res, next) => {
  try {
    const query = myAttemptQuerySchema.safeParse(req.query);
    if (!query.success) throw AppError.badRequest("assessmentId must be a positive integer");
    sendSuccess(res, await latestAssessmentAttempt(query.data.assessmentId, req.user!.id));
  } catch (error) { next(error); }
});

assessmentRouter.get("/attempts/:attemptId", async (req, res, next) => {
  try { sendSuccess(res, await getAssessmentAttemptState(parseId(req.params.attemptId), req.user!.id)); }
  catch (error) { next(error); }
});

assessmentRouter.put("/attempts/:attemptId/answers", async (req, res, next) => {
  try {
    const answer = validate(answerSchema, req.body);
    sendSuccess(res, await saveAssessmentAnswer(parseId(req.params.attemptId), req.user!.id, answer.questionId, answer.optionId));
  } catch (error) { next(error); }
});

assessmentRouter.post("/attempts/:attemptId/submit", async (req, res, next) => {
  try { sendSuccess(res, await submitAssessmentAttempt(parseId(req.params.attemptId), req.user!.id)); }
  catch (error) { next(error); }
});


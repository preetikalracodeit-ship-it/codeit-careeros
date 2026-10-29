import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { validate } from "../../lib/validators.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { answerSchema, assessmentIdSchema, latestAttemptQuerySchema } from "./assessment.schemas.js";
import { listPublishedAssessments } from "./assessment.service.js";
import { getAttemptState, getMyLatestAttempt, saveAttemptAnswer, startAttempt, submitAttempt } from "./attempt.service.js";

export const assessmentRouter = Router();
assessmentRouter.use(requireAuth, requireRole("STUDENT"));

assessmentRouter.get("/:careerId/available", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const careerId = validate(assessmentIdSchema, req.params.careerId);
    sendSuccess(res, await listPublishedAssessments(careerId));
  } catch (error) {
    next(error);
  }
});

assessmentRouter.get("/attempts/my", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = validate(latestAttemptQuerySchema, req.query);
    sendSuccess(res, await getMyLatestAttempt(query.assessmentId, req.user!.id));
  } catch (error) {
    next(error);
  }
});

assessmentRouter.get("/attempts/:attemptId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = validate(assessmentIdSchema, req.params.attemptId);
    sendSuccess(res, await getAttemptState(attemptId, req.user!.id));
  } catch (error) {
    next(error);
  }
});

assessmentRouter.post("/:assessmentId/start", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assessmentId = validate(assessmentIdSchema, req.params.assessmentId);
    sendSuccess(res, await startAttempt(assessmentId, req.user!.id));
  } catch (error) {
    next(error);
  }
});

assessmentRouter.put("/attempts/:attemptId/answers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = validate(assessmentIdSchema, req.params.attemptId);
    const input = validate(answerSchema, req.body);
    sendSuccess(res, await saveAttemptAnswer(attemptId, req.user!.id, input));
  } catch (error) {
    next(error);
  }
});

assessmentRouter.post("/attempts/:attemptId/submit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = validate(assessmentIdSchema, req.params.attemptId);
    sendSuccess(res, await submitAttempt(attemptId, req.user!.id));
  } catch (error) {
    next(error);
  }
});

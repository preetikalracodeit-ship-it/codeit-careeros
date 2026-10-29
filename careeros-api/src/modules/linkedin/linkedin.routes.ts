import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { validate } from "../../lib/validators.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { linkedInProfileSchema } from "./linkedin.schemas.js";
import { analyzeLinkedInProfile, getMyLinkedInProfile, saveLinkedInProfile } from "./linkedin.service.js";

export const linkedInRouter = Router();
linkedInRouter.use(requireAuth, requireRole("STUDENT"));

linkedInRouter.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await saveLinkedInProfile(req.user!.id, validate(linkedInProfileSchema, req.body)), { message: "LinkedIn profile saved" }); } catch (error) { next(error); }
});
linkedInRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getMyLinkedInProfile(req.user!.id)); } catch (error) { next(error); }
});
linkedInRouter.get("/analysis", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await analyzeLinkedInProfile(req.user!.id)); } catch (error) { next(error); }
});

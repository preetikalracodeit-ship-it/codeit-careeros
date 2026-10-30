import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getMyProgress } from "./progress.service.js";

export const progressRouter = Router();

progressRouter.get("/me", requireAuth, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getMyProgress(req.user!.id));
  } catch (error) {
    next(error);
  }
});


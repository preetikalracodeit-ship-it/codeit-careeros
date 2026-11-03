import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { validate } from "../../lib/validators.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { roadmapItemIdSchema, roadmapStatusSchema } from "./roadmap.schemas.js";
import { getMyRoadmap, updateRoadmapItemStatus } from "./roadmap.service.js";

export const roadmapRouter = Router();
roadmapRouter.use(requireAuth, requireRole("STUDENT"));

roadmapRouter.get("/my", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getMyRoadmap(req.user!.id)); } catch (error) { next(error); }
});

roadmapRouter.put("/items/:itemId/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = validate(roadmapItemIdSchema, req.params.itemId);
    const input = validate(roadmapStatusSchema, req.body);
    sendSuccess(res, await updateRoadmapItemStatus(req.user!.id, itemId, input.status));
  } catch (error) { next(error); }
});

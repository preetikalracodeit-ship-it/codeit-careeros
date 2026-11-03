import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { validate } from "../../lib/validators.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { projectIdSchema, projectStatusSchema } from "./project.schemas.js";
import { getRecommendedProjects, updateProjectStatus } from "./project.service.js";

export const projectRouter = Router();
projectRouter.use(requireAuth, requireRole("STUDENT"));

projectRouter.get("/recommended", async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getRecommendedProjects(req.user!.id)); } catch (error) { next(error); }
});

projectRouter.put("/:projectId/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = validate(projectIdSchema, req.params.projectId);
    const input = validate(projectStatusSchema, req.body);
    sendSuccess(res, await updateProjectStatus(req.user!.id, id, input.status));
  } catch (error) { next(error); }
});

import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { validate } from "../../lib/validators.js";
import { requireRole } from "../../middleware/auth.js";
import { getRecommendedProjects, updateProjectStatus } from "./project.service.js";

const idSchema = z.coerce.number().int().positive().safe();
const statusSchema = z.object({ status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]) });
export const projectRouter = Router();
projectRouter.use(requireRole("STUDENT"));
projectRouter.get("/recommended", async (req, res, next) => { try { sendSuccess(res, await getRecommendedProjects(req.user!.id)); } catch (error) { next(error); } });
projectRouter.put("/:projectId/status", async (req, res, next) => {
  try {
    const id = idSchema.safeParse(req.params.projectId);
    if (!id.success) throw AppError.badRequest("Project id must be a positive integer");
    const body = validate(statusSchema, req.body);
    sendSuccess(res, await updateProjectStatus(req.user!.id, id.data, body.status));
  } catch (error) { next(error); }
});

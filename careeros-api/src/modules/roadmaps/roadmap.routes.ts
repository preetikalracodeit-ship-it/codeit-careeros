import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { validate } from "../../lib/validators.js";
import { requireRole } from "../../middleware/auth.js";
import { getMyRoadmap, updateRoadmapItem } from "./roadmap.service.js";

const idSchema = z.coerce.number().int().positive().safe();
const statusSchema = z.object({ status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]) });
export const roadmapRouter = Router();
roadmapRouter.use(requireRole("STUDENT"));
roadmapRouter.get("/my", async (req, res, next) => { try { sendSuccess(res, await getMyRoadmap(req.user!.id)); } catch (error) { next(error); } });
roadmapRouter.put("/items/:itemId/status", async (req, res, next) => {
  try {
    const id = idSchema.safeParse(req.params.itemId);
    if (!id.success) throw AppError.badRequest("Item id must be a positive integer");
    const body = validate(statusSchema, req.body);
    sendSuccess(res, await updateRoadmapItem(req.user!.id, id.data, body.status));
  } catch (error) { next(error); }
});

import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { validate } from "../../lib/validators.js";
import { careerIdSchema } from "./career.schemas.js";
import {
  getPublishedCareer,
  getPublishedCareerSkills,
  listPublishedCareers,
} from "./career.service.js";

export const careerRouter = Router();

careerRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listPublishedCareers());
  } catch (error) {
    next(error);
  }
});

careerRouter.get("/:id/skills", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = validate(careerIdSchema, req.params.id);
    sendSuccess(res, await getPublishedCareerSkills(id));
  } catch (error) {
    next(error);
  }
});

careerRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = validate(careerIdSchema, req.params.id);
    sendSuccess(res, await getPublishedCareer(id));
  } catch (error) {
    next(error);
  }
});


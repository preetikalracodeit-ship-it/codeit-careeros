import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { Skill, type SkillDoc } from "../../models/Skill.js";

export const skillRouter = Router();

skillRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const skills = await Skill.find({ active: true }).sort({ name: 1, _id: 1 }).lean<SkillDoc[]>();
    sendSuccess(
      res,
      skills.map((s) => ({
        id: s._id,
        name: s.name,
        category: s.category,
        description: s.description ?? null,
        active: s.active,
      })),
    );
  } catch (error) {
    next(error);
  }
});


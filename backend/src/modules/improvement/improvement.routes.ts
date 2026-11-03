import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { AppError } from "../../lib/errors.js";
import { validate } from "../../lib/validators.js";
import { updateTaskSchema } from "./improvement.schemas.js";
import { getMyImprovementPlans, updateMyTask } from "./improvement.service.js";

export const improvementRouter = Router();

improvementRouter.get("/me/improvement-plans", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getMyImprovementPlans(req.user!.id));
  } catch (error) {
    next(error);
  }
});

improvementRouter.patch("/me/improvement-plans/tasks/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      throw AppError.notFound("Improvement task not found");
    }
    const input = validate(updateTaskSchema, req.body);
    sendSuccess(res, await updateMyTask(req.user!.id, taskId, input), { message: "Task updated" });
  } catch (error) {
    next(error);
  }
});

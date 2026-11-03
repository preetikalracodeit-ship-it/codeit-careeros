import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { AppError } from "../../lib/errors.js";
import { validate } from "../../lib/validators.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { createSessionSchema, sendMessageSchema } from "./ai.schemas.js";
import {
  aiStatus,
  createSession,
  deleteSession,
  getHistory,
  listSessions,
  sendMessage,
} from "./ai.service.js";

export const aiRouter = Router();
aiRouter.use(requireAuth, requireRole("STUDENT"));

function sessionId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw AppError.notFound("Conversation not found");
  return id;
}

aiRouter.get("/status", (_req: Request, res: Response) => {
  sendSuccess(res, aiStatus());
});

aiRouter.get("/chat/sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listSessions(req.user!.id));
  } catch (error) {
    next(error);
  }
});

aiRouter.post("/chat/sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(createSessionSchema, req.body ?? {});
    sendSuccess(res, await createSession(req.user!.id, input.title), {
      message: "Conversation started",
      status: 201,
    });
  } catch (error) {
    next(error);
  }
});

aiRouter.get("/chat/sessions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getHistory(req.user!.id, sessionId(String(req.params.id))));
  } catch (error) {
    next(error);
  }
});

aiRouter.post("/chat/sessions/:id/messages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(sendMessageSchema, req.body);
    sendSuccess(res, await sendMessage(req.user!.id, sessionId(String(req.params.id)), input.message), {
      message: "Reply generated",
    });
  } catch (error) {
    next(error);
  }
});

aiRouter.delete("/chat/sessions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteSession(req.user!.id, sessionId(String(req.params.id)));
    sendSuccess(res, null, { message: "Conversation deleted" });
  } catch (error) {
    next(error);
  }
});


import { Router, type NextFunction, type Request, type Response } from "express";
import { validate } from "../../lib/validators.js";
import { sendSuccess } from "../../lib/response.js";
import { requireAuth } from "../../middleware/auth.js";
import { changePasswordSchema } from "../auth/auth.schemas.js";
import { changePassword, getSettings, revokeAllSessions } from "./settings.service.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/settings/me",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await getSettings(req.user!.id));
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.put(
  "/users/me/password",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validate(changePasswordSchema, req.body);
      await changePassword(req.user!.id, input);
      sendSuccess(res, null, {
        message: "Password changed successfully. Please log in again on other devices.",
      });
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.post(
  "/users/me/sessions/revoke-all",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const revoked = await revokeAllSessions(req.user!.id);
      sendSuccess(res, { revokedSessions: revoked }, { message: "All sessions revoked" });
    } catch (error) {
      next(error);
    }
  },
);

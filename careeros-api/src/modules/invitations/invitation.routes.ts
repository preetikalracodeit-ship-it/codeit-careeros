import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { authRateLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../lib/validators.js";
import { sendSuccess } from "../../lib/response.js";
import { invitationAcceptSchema } from "./invitation.schemas.js";
import { acceptInvitation, publicInvitation } from "./invitation.service.js";

const tokenSchema = z.string().min(1).max(200);
function parseToken(raw: string | string[]) {
  if (typeof raw !== "string") throw AppError.badRequest("Invitation token is invalid");
  const parsed = tokenSchema.safeParse(raw);
  if (!parsed.success) throw AppError.badRequest("Invitation token is invalid");
  return parsed.data;
}
export const invitationRouter = Router();
invitationRouter.get("/:token", authRateLimiter, async (req, res, next) => {
  try { sendSuccess(res, await publicInvitation(parseToken(req.params.token))); }
  catch (error) { next(error); }
});
invitationRouter.post("/:token/accept", authRateLimiter, async (req, res, next) => {
  try {
    const token = parseToken(req.params.token);
    const input = validate(invitationAcceptSchema, req.body);
    sendSuccess(res, await acceptInvitation(token, input), { message: "Invitation accepted" });
  } catch (error) { next(error); }
});

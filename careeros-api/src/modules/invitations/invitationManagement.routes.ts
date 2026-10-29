import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { requireCollegeAdmin } from "../college/collegeAccess.service.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../lib/validators.js";
import { invitationCreateSchema } from "./invitation.schemas.js";
import {
  createBootstrapInvitation,
  createCollegeInvitation,
  listCollegeInvitations,
  revokeCollegeInvitation,
} from "./invitation.service.js";

export const collegeInvitationManagementRouter = Router();
export const adminInvitationManagementRouter = Router();

function numericId(value: string, label: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw AppError.notFound(`${label} not found`);
  }
  return id;
}

collegeInvitationManagementRouter.use(requireAuth);

collegeInvitationManagementRouter.get(
  "/staff/invitations",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { membership } = await requireCollegeAdmin(req.user!.id);
      sendSuccess(res, await listCollegeInvitations(membership.institutionId));
    } catch (error) {
      next(error);
    }
  },
);

collegeInvitationManagementRouter.post(
  "/staff/invitations",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { membership } = await requireCollegeAdmin(req.user!.id);
      const input = validate(invitationCreateSchema, req.body);
      sendSuccess(
        res,
        await createCollegeInvitation(membership.institutionId, req.user!.id, input),
        { message: "Invitation created" },
      );
    } catch (error) {
      next(error);
    }
  },
);

collegeInvitationManagementRouter.post(
  "/staff/invitations/:id/revoke",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { membership } = await requireCollegeAdmin(req.user!.id);
      await revokeCollegeInvitation(
        membership.institutionId,
        req.user!.id,
        numericId(String(req.params.id), "Invitation"),
      );
      sendSuccess(res, null, { message: "Invitation revoked" });
    } catch (error) {
      next(error);
    }
  },
);

adminInvitationManagementRouter.post(
  "/institutions/:id/invitations",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const institutionId = numericId(String(req.params.id), "Institution");
      const input = validate(invitationCreateSchema, req.body);
      sendSuccess(
        res,
        await createBootstrapInvitation(institutionId, input),
        { message: "Bootstrap invitation created" },
      );
    } catch (error) {
      next(error);
    }
  },
);

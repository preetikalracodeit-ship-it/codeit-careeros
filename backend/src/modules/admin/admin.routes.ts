import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../lib/errors.js";
import { validate } from "../../lib/validators.js";
import { z } from "zod";
import { sendSuccess } from "../../lib/response.js";
import { requireRole } from "../../middleware/auth.js";
import {
  createInstitution,
  listInstitutions,
  updateInstitution,
  toggleInstitutionStatus,
  listAdministrators,
  listInstitutionMemberships,
  updateInstitutionMembershipStatus,
  inviteAdministrator,
  updateAdministratorStatus,
  listStudentsForAdmin,
  getAllStudentCount,
  getStats,
  getStudentCount,
} from "./admin.service.js";
import {
  institutionCreateSchema,
  institutionUpdateSchema,
  adminInviteSchema,
  adminStatusSchema,
} from "./admin.schemas.js";

export const adminRouter = Router();
adminRouter.use(requireRole("SUPER_ADMIN"));

// Institutions
adminRouter.get("/institutions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listInstitutions(req.user as any));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/institutions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(institutionCreateSchema, req.body);
    sendSuccess(res, await createInstitution(input, req.user as any), { message: "Institution created" });
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/institutions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(institutionUpdateSchema, req.body);
    const updated = await updateInstitution(Number(req.params.id), input, req.user as any);
    sendSuccess(res, updated, { message: "Institution updated" });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/institutions/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawStatus = (req.query.status as string) || req.body?.status;
    const status = String(rawStatus ?? "").toUpperCase();
    if (status !== "ACTIVE" && status !== "INACTIVE") {
      throw AppError.badRequest("Status must be ACTIVE or INACTIVE");
    }
    const institution = await toggleInstitutionStatus(Number(req.params.id), status, req.user as any);
    sendSuccess(res, institution, { message: "Institution status updated" });
  } catch (error) {
    next(error);
  }
});

// Memberships (frontend calls /admin/institutions/:id/memberships)
adminRouter.get("/institutions/:id/memberships", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listInstitutionMemberships(Number(req.params.id), req.user as any));
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/institutions/:id/memberships/:membershipId/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawStatus = (req.query.status as string) || req.body?.status;
    const status = String(rawStatus ?? "").toUpperCase();
    if (status !== "ACTIVE" && status !== "INACTIVE") {
      throw AppError.badRequest("Status must be ACTIVE or INACTIVE");
    }
    const membership = await updateInstitutionMembershipStatus(
      Number(req.params.id),
      Number(req.params.membershipId),
      status,
      req.user as any,
    );
    sendSuccess(res, membership, { message: "Membership status updated" });
  } catch (error) {
    next(error);
  }
});

// Legacy / backwards compatibility aliases
adminRouter.get("/institutions/:id/administrators", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listAdministrators(Number(req.params.id), req.user as any));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/institutions/:id/administrators", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(adminInviteSchema, req.body);
    const administrator = await inviteAdministrator(Number(req.params.id), input, req.user as any);
    sendSuccess(res, administrator);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/administrators/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(adminStatusSchema, req.body);
    const administrator = await updateAdministratorStatus(
      Number(req.params.id),
      Number(req.params.memberId || req.params.id),
      input.status,
      req.user as any,
    );
    sendSuccess(res, administrator);
  } catch (error) {
    next(error);
  }
});

// Students & Stats
adminRouter.get("/students/count", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, { count: await getAllStudentCount() });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/students/count/:institutionId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await getStudentCount(Number(req.params.institutionId));
    sendSuccess(res, { count });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/students", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = validate(z.object({
      page: z.coerce.number().int().min(-2147483648).max(2147483647).optional(),
      size: z.coerce.number().int().min(-2147483648).max(2147483647).optional(),
      search: z.string().optional(),
    }), req.query);
    sendSuccess(res, await listStudentsForAdmin(query.page ?? 0, query.size ?? 20, query.search));
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getStats());
  } catch (error) {
    next(error);
  }
});

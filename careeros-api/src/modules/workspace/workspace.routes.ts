import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { validate } from "../../lib/validators.js";
import {
  requireAnyRole,
  requireAuth,
  requireCollegeStaff,
  requireRole,
} from "../../middleware/auth.js";
import {
  addBatch,
  addDepartment,
  createCollege,
  createStaff,
  getCollege,
  getDepartmentWorkspace,
  getReadinessOverview,
  getStudent,
  getSummary,
  getWorkspaceMe,
  listColleges,
  listMentees,
  listPlacementDrives,
  listSkillGaps,
  listStaff,
  listStudents,
  updateCollege,
  updateStaff,
} from "./workspace.service.js";
import {
  batchCreateSchema,
  collegeCreateSchema,
  collegeUpdateSchema,
  departmentCreateSchema,
  staffCreateSchema,
  staffUpdateSchema,
} from "./workspace.schemas.js";

export const workspaceRouter = Router();

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized("Authentication is required");
  return req.user;
}

function numericParam(req: Request, name: string): number {
  const value = Number(req.params[name]);
  if (!Number.isInteger(value) || value <= 0) {
    throw AppError.badRequest("A valid numeric identifier is required");
  }
  return value;
}

function effectiveCollegeId(req: Request, requested: number): number {
  if (req.user?.role === "SUPER_ADMIN") return requested;
  if (!req.user?.collegeId) {
    throw AppError.badRequest("No college workspace is assigned to this account");
  }
  return req.user.collegeId;
}

function wrap(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}

workspaceRouter.use(requireAuth);

workspaceRouter.get(
  "/me",
  wrap(async (req, res) => {
    sendSuccess(res, await getWorkspaceMe(actor(req)));
  }),
);

workspaceRouter.get(
  "/summary",
  wrap(async (req, res) => {
    sendSuccess(res, await getSummary(actor(req)));
  }),
);

workspaceRouter.get(
  "/colleges",
  requireRole("SUPER_ADMIN"),
  wrap(async (_req, res) => {
    sendSuccess(res, await listColleges());
  }),
);

workspaceRouter.post(
  "/colleges",
  requireRole("SUPER_ADMIN"),
  wrap(async (req, res) => {
    const input = validate(collegeCreateSchema, req.body);
    sendSuccess(res, await createCollege(input, actor(req)), { status: 201 });
  }),
);

workspaceRouter.get(
  "/colleges/:id",
  requireRole("SUPER_ADMIN"),
  wrap(async (req, res) => {
    sendSuccess(res, await getCollege(numericParam(req, "id")));
  }),
);

workspaceRouter.patch(
  "/colleges/:id",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN"),
  wrap(async (req, res) => {
    const input = validate(collegeUpdateSchema, req.body);
    const collegeId = effectiveCollegeId(req, numericParam(req, "id"));
    sendSuccess(res, await updateCollege(collegeId, input));
  }),
);

workspaceRouter.post(
  "/colleges/:id/departments",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN"),
  wrap(async (req, res) => {
    const input = validate(departmentCreateSchema, req.body);
    const collegeId = effectiveCollegeId(req, numericParam(req, "id"));
    sendSuccess(res, await addDepartment(collegeId, input), { status: 201 });
  }),
);

workspaceRouter.post(
  "/colleges/:id/batches",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN"),
  wrap(async (req, res) => {
    const input = validate(batchCreateSchema, req.body);
    const collegeId = effectiveCollegeId(req, numericParam(req, "id"));
    sendSuccess(res, await addBatch(collegeId, input), { status: 201 });
  }),
);

workspaceRouter.get(
  "/department",
  requireCollegeStaff,
  wrap(async (req, res) => {
    sendSuccess(res, await getDepartmentWorkspace(actor(req)));
  }),
);

workspaceRouter.get(
  "/staff",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN"),
  wrap(async (req, res) => {
    sendSuccess(res, await listStaff(actor(req)));
  }),
);

workspaceRouter.post(
  "/staff",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN"),
  wrap(async (req, res) => {
    const input = validate(staffCreateSchema, req.body);
    sendSuccess(res, await createStaff(actor(req), input), { status: 201 });
  }),
);

workspaceRouter.patch(
  "/staff/:id",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN"),
  wrap(async (req, res) => {
    const input = validate(staffUpdateSchema, req.body);
    sendSuccess(res, await updateStaff(actor(req), numericParam(req, "id"), input));
  }),
);

workspaceRouter.get(
  "/students",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"),
  wrap(async (req, res) => {
    sendSuccess(res, await listStudents(actor(req)));
  }),
);

workspaceRouter.get(
  "/students/:id",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"),
  wrap(async (req, res) => {
    sendSuccess(res, await getStudent(actor(req), numericParam(req, "id")));
  }),
);

workspaceRouter.get(
  "/readiness",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"),
  wrap(async (req, res) => {
    sendSuccess(res, await getReadinessOverview(actor(req)));
  }),
);

workspaceRouter.get(
  "/skill-gaps",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"),
  wrap(async (req, res) => {
    sendSuccess(res, await listSkillGaps(actor(req)));
  }),
);

workspaceRouter.get(
  "/mentees",
  requireAnyRole("HOD", "FACULTY"),
  wrap(async (req, res) => {
    sendSuccess(res, await listMentees(actor(req)));
  }),
);

workspaceRouter.get(
  "/placement/drives",
  requireAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "TPO"),
  wrap(async (req, res) => {
    sendSuccess(res, await listPlacementDrives(actor(req)));
  }),
);

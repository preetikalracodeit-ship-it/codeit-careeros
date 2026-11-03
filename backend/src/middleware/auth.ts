import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "../lib/errors.js";
import { User, isStaffRole, type Role } from "../models/User.js";

export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(Number(payload.sub)).lean();
    if (user && user.status === "ACTIVE") {
      req.user = {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        collegeId: user.collegeId ?? null,
        departmentId: user.departmentId ?? null,
      };
    }
  } catch {
    req.user = undefined;
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(AppError.unauthorized("Authentication is required"));
    return;
  }
  next();
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized("Authentication is required"));
      return;
    }
    if (req.user.role !== role) {
      next(AppError.forbidden("You do not have permission to perform this action"));
      return;
    }
    next();
  };
}

export function requireAnyRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized("Authentication is required"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden("You do not have permission to perform this action"));
      return;
    }
    next();
  };
}

export function requireCollegeStaff(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(AppError.unauthorized("Authentication is required"));
    return;
  }
  if (!isStaffRole(req.user.role)) {
    next(AppError.forbidden("This area is only available to college staff"));
    return;
  }
  next();
}

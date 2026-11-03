import type { Role } from "../models/User.ts";

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: number;
      email: string;
      fullName: string;
      role: Role;
      collegeId?: number | null;
      departmentId?: number | null;
    }

    interface Request {
      requestId: string;
      user?: AuthenticatedUser;
    }
  }
}

export {};

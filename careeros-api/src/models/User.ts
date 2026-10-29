import mongoose, { Schema } from "mongoose";

export const ROLES = [
  "SUPER_ADMIN",
  "COLLEGE_ADMIN",
  "TPO",
  "HOD",
  "FACULTY",
  "STUDENT",
] as const;
export const USER_STATUSES = ["ACTIVE", "INACTIVE", "LOCKED"] as const;

export const STAFF_ROLES = ["COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"] as const;

export type Role = (typeof ROLES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export interface UserDoc {
  _id: number;
  email: string;
  emailLower: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  collegeId?: number | null;
  departmentId?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    _id: { type: Number, required: true },
    email: { type: String, required: true, maxlength: 190 },
    emailLower: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, maxlength: 120 },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: USER_STATUSES, required: true, default: "ACTIVE" },
    collegeId: { type: Number, default: null },
    departmentId: { type: Number, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

userSchema.index({ role: 1 }, { name: "idx_users_role" });
userSchema.index({ collegeId: 1, role: 1 }, { name: "idx_users_college_role" });

export const User =
  (mongoose.models.User as mongoose.Model<UserDoc>) ??
  mongoose.model<UserDoc>("User", userSchema);

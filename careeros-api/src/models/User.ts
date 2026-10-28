import mongoose, { Schema } from "mongoose";

export const ROLES = ["STUDENT", "PROFESSOR", "ADMIN"] as const;
export const USER_STATUSES = ["ACTIVE", "INACTIVE", "LOCKED"] as const;

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserDoc {
  _id: number;
  email: string;
  emailLower: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  status: UserStatus;
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
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

userSchema.index({ role: 1 }, { name: "idx_users_role" });

export const User =
  (mongoose.models.User as mongoose.Model<UserDoc>) ??
  mongoose.model<UserDoc>("User", userSchema);

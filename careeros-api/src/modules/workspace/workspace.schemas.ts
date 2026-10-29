import { z } from "zod";
import { STAFF_ROLES, USER_STATUSES } from "../../models/User.js";

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const collegeCreateSchema = z.object({
  name: z.string({ error: "College name is required" }).trim().min(1, "College name is required").max(160),
  code: z.string({ error: "College code is required" }).trim().min(1, "College code is required").max(32),
  city: optionalText(120),
  state: optionalText(120),
  website: z.string().trim().url("Website must be a valid URL").max(200).optional().or(z.literal("")),
  contactEmail: z.string().trim().email("Contact email must be valid").max(190).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "SUSPENDED", "ONBOARDING"]).optional(),
});

export const collegeUpdateSchema = collegeCreateSchema.partial().extend({
  name: z.string().trim().min(1).max(160).optional(),
  code: z.string().trim().min(1).max(32).optional(),
});

export const departmentCreateSchema = z.object({
  name: z.string({ error: "Department name is required" }).trim().min(1, "Department name is required").max(120),
  code: z.string({ error: "Department code is required" }).trim().min(1, "Department code is required").max(24),
  hodName: optionalText(120),
});

export const batchCreateSchema = z.object({
  name: z.string({ error: "Batch name is required" }).trim().min(1, "Batch name is required").max(80),
  departmentId: z.coerce.number({ error: "Department is required" }).int().positive(),
  year: z.coerce.number({ error: "Batch year is required" }).int().min(2000).max(2100),
});

export const staffCreateSchema = z.object({
  fullName: z.string({ error: "Full name is required" }).trim().min(1, "Full name is required").max(120),
  email: z.string({ error: "Email is required" }).trim().email("Email must be valid").max(190),
  password: z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(128),
  role: z.enum(STAFF_ROLES, { error: "Choose a college staff role" }),
  collegeId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
});

export const staffUpdateSchema = z.object({
  role: z.enum(STAFF_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
});

export type CollegeCreateInput = z.infer<typeof collegeCreateSchema>;
export type CollegeUpdateInput = z.infer<typeof collegeUpdateSchema>;
export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>;
export type BatchCreateInput = z.infer<typeof batchCreateSchema>;
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;

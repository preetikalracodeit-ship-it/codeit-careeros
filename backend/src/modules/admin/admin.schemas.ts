import { z } from "zod";

export const institutionCreateSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(1).max(160),
  timezone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const institutionUpdateSchema = z.object({
  code: z.string().min(2).max(40).optional(),
  name: z.string().min(1).max(160).optional(),
  timezone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const institutionStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const adminInviteSchema = z.object({
  email: z.string().email(),
  designation: z.enum(["COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"]),
  scopeType: z.enum(["INSTITUTION", "DEPARTMENT", "PROGRAM", "BATCH", "SECTION"]),
  scopeId: z.number().int().positive().optional(),
});

export const adminStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type InstitutionCreateInput = z.infer<typeof institutionCreateSchema>;
export type InstitutionUpdateInput = z.infer<typeof institutionUpdateSchema>;
export type AdminInviteInput = z.infer<typeof adminInviteSchema>;
export type AdminStatusInput = z.infer<typeof adminStatusSchema>;

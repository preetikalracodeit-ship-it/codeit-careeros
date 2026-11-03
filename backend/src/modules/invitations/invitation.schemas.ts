import { z } from "zod";
import { SCOPE_TYPES, STAFF_DESIGNATIONS } from "../../models/InstitutionMembership.js";

export const invitationAcceptSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  password: z.string().max(128),
  termsAccepted: z.boolean().optional(),
});
export type InvitationAcceptInput = z.infer<typeof invitationAcceptSchema>;

export const invitationCreateSchema = z.object({
  email: z.string().trim().min(1).max(190).email(),
  designation: z.enum(STAFF_DESIGNATIONS),
  scopeType: z.enum(SCOPE_TYPES),
  scopeId: z.number().int().positive().safe().nullable().optional(),
});
export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;

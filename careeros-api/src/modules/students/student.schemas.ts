import { z } from "zod";

const nullableText = (max: number) =>
  z.string().max(max, `Must be at most ${max} characters`).nullable().optional();

export const updateStudentProfileSchema = z.object({
  fullName: z
    .string()
    .max(120, "Full name must be at most 120 characters")
    .refine((value) => value.trim().length > 0, "Full name is required"),
  mobile: z
    .string()
    .max(20, "Mobile must be at most 20 characters")
    .regex(/^$|^[6-9][0-9]{9}$/, "Mobile must be a 10-digit number starting with 6, 7, 8 or 9")
    .nullable()
    .optional(),
  dateOfBirth: z.string().date().nullable().optional(),
  college: nullableText(150),
  degree: nullableText(100),
  branch: nullableText(100),
  graduationYear: z
    .number()
    .int()
    .min(2000, "Graduation year must be at least 2000")
    .max(2100, "Graduation year must be at most 2100")
    .nullable()
    .optional(),
  semester: z
    .number()
    .int()
    .min(1, "Semester must be at least 1")
    .max(12, "Semester must be at most 12")
    .nullable()
    .optional(),
  location: nullableText(150),
  githubUrl: nullableText(250),
  linkedinUrl: nullableText(250),
  portfolioUrl: nullableText(250),
});

export const assessmentHistoryQuerySchema = z.object({
  assessmentId: z.coerce.number().int().positive().optional(),
});

export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;

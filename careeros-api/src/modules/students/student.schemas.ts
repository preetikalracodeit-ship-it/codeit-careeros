import { z } from "zod";

const nullableText = (max: number) =>
  z.string().max(max, `Must be at most ${max} characters`).nullable().optional();

const nullableUrl = (max: number, label: string) =>
  nullableText(max).refine(
    (value) => !value || /^https?:\/\/[^\s]+$/i.test(value),
    `${label} must be a full URL starting with http:// or https://`,
  );

function todayIsoDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

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
  dateOfBirth: z.string().date()
    .refine((value) => value <= todayIsoDate(), "Date of birth cannot be in the future")
    .nullable().optional(),
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
  githubUrl: nullableUrl(250, "GitHub URL"),
  linkedinUrl: nullableUrl(250, "LinkedIn URL"),
  portfolioUrl: nullableUrl(250, "Portfolio URL"),
});

export const assessmentHistoryQuerySchema = z.object({
  assessmentId: z.coerce.number().int().positive().optional(),
});

export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;

import { z } from "zod";

const nullableString = (max: number) =>
  z.string().max(max).nullable().optional();

export const studentProfileUpdateSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(120, "Full name must be at most 120 characters")
    .refine((value) => value.trim().length > 0, "Full name is required"),
  mobile: z.string().max(20, "Mobile must be at most 20 characters")
    .regex(/^(?:|[6-9][0-9]{9})$/, "Mobile must be a 10-digit number starting with 6, 7, 8 or 9")
    .nullable().optional(),
  dateOfBirth: z.iso.date().nullable().optional(),
  college: nullableString(150),
  degree: nullableString(100),
  branch: nullableString(100),
  graduationYear: z.number().int().min(2000, "Graduation year must be at least 2000")
    .max(2100, "Graduation year must be at most 2100").nullable().optional(),
  semester: z.number().int().min(1, "Semester must be at least 1")
    .max(12, "Semester must be at most 12").nullable().optional(),
  location: nullableString(150),
  githubUrl: nullableString(250),
  linkedinUrl: nullableString(250),
  portfolioUrl: nullableString(250),
});

export type StudentProfileUpdateInput = z.infer<typeof studentProfileUpdateSchema>;

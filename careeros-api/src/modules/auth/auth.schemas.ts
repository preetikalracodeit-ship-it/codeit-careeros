import { z } from "zod";

const STRONG_PASSWORD_MESSAGE =
  "Password must be at least 8 characters and contain letters and digits";

export const strongPassword = z
  .string({ error: "Password is required" })
  .min(1, "Password is required")
  .refine(
    (value) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value),
    STRONG_PASSWORD_MESSAGE,
  );

export const registerSchema = z.object({
  fullName: z
    .string({ error: "Full name is required" })
    .trim()
    .min(1, "Full name is required")
    .max(120, "Full name must be at most 120 characters"),
  email: z
    .string({ error: "Email is required" })
    .trim()
    .min(1, "Email is required")
    .max(190, "Email must be at most 190 characters")
    .email("Email must be valid"),
  mobile: z
    .string({ error: "Mobile number is required" })
    .trim()
    .min(1, "Mobile number is required")
    .regex(
      /^[6-9][0-9]{9}$/,
      "Mobile must be a 10-digit number starting with 6, 7, 8 or 9",
    ),
  password: strongPassword,
  termsAccepted: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .trim()
    .min(1, "Email is required")
    .email("Email must be valid"),
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z
    .string({ error: "Refresh token is required" })
    .min(1, "Refresh token is required"),
});

export const googleSchema = z.object({
  idToken: z.string({ error: "Google ID token is required" }).min(1, "Google ID token is required"),
  termsAccepted: z.boolean().optional(),
});

export const consentAcceptSchema = z.object({
  termsAccepted: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ error: "Current password is required" })
    .min(1, "Current password is required"),
  newPassword: strongPassword,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type GoogleInput = z.infer<typeof googleSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

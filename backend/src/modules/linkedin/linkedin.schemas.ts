import { z } from "zod";

const optionalText = (max: number) => z.string().max(max).nullable().optional();
export const linkedInProfileSchema = z.object({
  profileUrl: z.string().trim().min(1, "LinkedIn profile URL is required").max(500)
    .refine((value) => /^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\/in\/[a-z0-9_.\-/%]+\/?$/i.test(value.startsWith("http") ? value : `https://${value}`), "Please provide a valid personal LinkedIn profile URL (https://www.linkedin.com/in/your-name)"),
  headline: optionalText(220),
  about: optionalText(3000),
  currentRole: optionalText(180),
  experienceText: optionalText(5000),
  skillsText: optionalText(2000),
  educationText: optionalText(2000),
});

export type LinkedInProfileInput = z.infer<typeof linkedInProfileSchema>;

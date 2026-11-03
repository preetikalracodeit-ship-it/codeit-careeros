import { z } from "zod";

export const assessmentIdSchema = z.coerce.number().int().positive();
export const answerSchema = z.object({
  questionId: z.number().int().positive(),
  optionId: z.number().int().positive(),
});
export const latestAttemptQuerySchema = z.object({
  assessmentId: z.coerce.number().int().positive(),
});

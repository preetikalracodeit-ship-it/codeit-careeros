import { z } from "zod";

export const assessmentIdSchema = z.coerce.number().int().positive().safe();
export const answerSchema = z.object({
  questionId: z.number().int().positive().safe(),
  optionId: z.number().int().positive().safe(),
});
export const myAttemptQuerySchema = z.object({
  assessmentId: z.coerce.number().int().positive().safe(),
});
export const attemptHistoryQuerySchema = z.object({
  assessmentId: z.coerce.number().int().positive().safe().optional(),
});

import { z } from "zod";

export const careerIdSchema = z.coerce.number().int().positive().safe();
export const targetCareerSchema = z.object({
  careerId: z.number().int().positive().safe(),
});

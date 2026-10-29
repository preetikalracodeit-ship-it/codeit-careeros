import { z } from "zod";
import { ROADMAP_STATUSES } from "../../models/RoadmapItemProgress.js";

export const projectIdSchema = z.coerce.number().int().positive();
export const projectStatusSchema = z.object({
  status: z.string().trim().min(1, "Status is required").transform((value) => value.toUpperCase()).pipe(z.enum(ROADMAP_STATUSES)),
});

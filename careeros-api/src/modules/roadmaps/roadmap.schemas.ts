import { z } from "zod";
import { ROADMAP_STATUSES } from "../../models/RoadmapItemProgress.js";

export const roadmapItemIdSchema = z.coerce.number().int().positive();
export const roadmapStatusSchema = z.object({
  status: z.string().trim().min(1, "Status is required").transform((value) => value.toUpperCase()).pipe(z.enum(ROADMAP_STATUSES)),
});

export type RoadmapStatusInput = z.infer<typeof roadmapStatusSchema>;

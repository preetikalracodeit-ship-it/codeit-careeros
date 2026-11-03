import { z } from "zod";

export const updateTaskSchema = z.object({
  status: z.string().trim().min(1, "A task status is required").transform((value) => value.toUpperCase()),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

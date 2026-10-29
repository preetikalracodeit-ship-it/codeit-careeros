import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().trim().max(160).optional(),
}).default({});

export const sendMessageSchema = z.object({
  message: z.string().trim().min(1, "Please enter a message").max(4000, "Keep your message under 4000 characters"),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

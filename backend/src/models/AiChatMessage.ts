import mongoose, { Schema } from "mongoose";

export const CHAT_ROLES = ["USER", "ASSISTANT"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export interface AiChatMessageDoc {
  _id: number;
  sessionId: number;
  userId: number;
  role: ChatRole;
  content: string;
  createdAt: Date;
}

const schema = new Schema<AiChatMessageDoc>(
  {
    _id: { type: Number, required: true },
    sessionId: { type: Number, required: true },
    userId: { type: Number, required: true },
    role: { type: String, enum: CHAT_ROLES, required: true },
    content: { type: String, required: true, maxlength: 20000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, id: false },
);
schema.index({ sessionId: 1, createdAt: 1 }, { name: "idx_ai_messages_session" });

export const AiChatMessage =
  (mongoose.models.AiChatMessage as mongoose.Model<AiChatMessageDoc>) ??
  mongoose.model<AiChatMessageDoc>("AiChatMessage", schema);

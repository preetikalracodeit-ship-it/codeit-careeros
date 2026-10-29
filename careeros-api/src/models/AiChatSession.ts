import mongoose, { Schema } from "mongoose";

export interface AiChatSessionDoc {
  _id: number;
  userId: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<AiChatSessionDoc>(
  {
    _id: { type: Number, required: true },
    userId: { type: Number, required: true },
    title: { type: String, required: true, maxlength: 160 },
  },
  { timestamps: true, versionKey: false, id: false },
);
schema.index({ userId: 1, updatedAt: -1 }, { name: "idx_ai_sessions_user_updated" });

export const AiChatSession =
  (mongoose.models.AiChatSession as mongoose.Model<AiChatSessionDoc>) ??
  mongoose.model<AiChatSessionDoc>("AiChatSession", schema);

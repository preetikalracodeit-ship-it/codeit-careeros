import mongoose, { Schema } from "mongoose";

export interface PasswordResetTokenDoc {
  _id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const schema = new Schema<PasswordResetTokenDoc>({
  _id: { type: Number, required: true },
  userId: { type: Number, required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false, required: true },
  createdAt: { type: Date, default: Date.now, required: true },
}, { versionKey: false, id: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ userId: 1, used: 1 });

export const PasswordResetToken = (mongoose.models.PasswordResetToken as mongoose.Model<PasswordResetTokenDoc>) ?? mongoose.model<PasswordResetTokenDoc>("PasswordResetToken", schema);

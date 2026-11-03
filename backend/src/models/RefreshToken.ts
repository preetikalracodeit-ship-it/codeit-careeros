import mongoose, { Schema } from "mongoose";

export interface RefreshTokenDoc {
  _id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  replacedById?: number | null;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    _id: { type: Number, required: true },
    userId: { type: Number, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, required: true, default: false },
    replacedById: { type: Number, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    id: false,
  },
);

refreshTokenSchema.index({ userId: 1 }, { name: "idx_refresh_tokens_user_id" });
refreshTokenSchema.index({ expiresAt: 1 }, { name: "idx_refresh_tokens_expires_at", expireAfterSeconds: 0 });

export const RefreshToken =
  (mongoose.models.RefreshToken as mongoose.Model<RefreshTokenDoc>) ??
  mongoose.model<RefreshTokenDoc>("RefreshToken", refreshTokenSchema);

import mongoose, { Schema } from "mongoose";

export const ROADMAP_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export interface RoadmapItemProgressDoc {
  _id: number;
  userId: number;
  itemId: number;
  status: RoadmapStatus;
  updatedAt: Date;
}

const schema = new Schema<RoadmapItemProgressDoc>({
  _id: { type: Number, required: true },
  userId: { type: Number, required: true },
  itemId: { type: Number, required: true },
  status: { type: String, enum: ROADMAP_STATUSES, required: true, default: "NOT_STARTED" },
}, { timestamps: { createdAt: false, updatedAt: true }, versionKey: false, id: false });
schema.index({ userId: 1, itemId: 1 }, { unique: true, name: "uk_roadmap_progress_user_item" });
schema.index({ itemId: 1 }, { name: "idx_roadmap_progress_item" });

export const RoadmapItemProgress =
  (mongoose.models.RoadmapItemProgress as mongoose.Model<RoadmapItemProgressDoc>) ??
  mongoose.model<RoadmapItemProgressDoc>("RoadmapItemProgress", schema);

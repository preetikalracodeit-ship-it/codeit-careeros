import mongoose, { Schema } from "mongoose";
export const PROGRESS_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];
export interface RoadmapItemProgressDoc { _id: number; userId: number; roadmapItemId: number; status: ProgressStatus; updatedAt: Date; }
const schema = new Schema<RoadmapItemProgressDoc>({ _id: { type: Number, required: true }, userId: { type: Number, required: true }, roadmapItemId: { type: Number, required: true }, status: { type: String, enum: PROGRESS_STATUSES, default: "NOT_STARTED" } }, { timestamps: { createdAt: false, updatedAt: true }, versionKey: false, id: false, collection: "roadmap_item_progress" });
schema.index({ userId: 1, roadmapItemId: 1 }, { unique: true, name: "uk_roadmap_progress_user_item" });
export const RoadmapItemProgress = (mongoose.models.RoadmapItemProgress as mongoose.Model<RoadmapItemProgressDoc>) ?? mongoose.model<RoadmapItemProgressDoc>("RoadmapItemProgress", schema);

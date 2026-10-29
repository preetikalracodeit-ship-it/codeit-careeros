import mongoose, { Schema } from "mongoose";
import { ROADMAP_STATUSES, type RoadmapStatus } from "./RoadmapItemProgress.js";

export interface ProjectProgressDoc { _id: number; userId: number; projectId: number; status: RoadmapStatus; updatedAt: Date; }

const schema = new Schema<ProjectProgressDoc>({
  _id: { type: Number, required: true },
  userId: { type: Number, required: true },
  projectId: { type: Number, required: true },
  status: { type: String, enum: ROADMAP_STATUSES, required: true, default: "NOT_STARTED" },
}, { timestamps: { createdAt: false, updatedAt: true }, versionKey: false, id: false });
schema.index({ userId: 1, projectId: 1 }, { unique: true, name: "uk_project_progress_user_project" });
schema.index({ projectId: 1 }, { name: "idx_project_progress_project" });

export const ProjectProgress = (mongoose.models.ProjectProgress as mongoose.Model<ProjectProgressDoc>) ?? mongoose.model<ProjectProgressDoc>("ProjectProgress", schema);

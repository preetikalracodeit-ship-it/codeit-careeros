import mongoose, { Schema } from "mongoose";
import { PROGRESS_STATUSES, type ProgressStatus } from "./RoadmapItemProgress.js";
export interface ProjectProgressDoc { _id: number; userId: number; projectId: number; status: ProgressStatus; updatedAt: Date; }
const schema = new Schema<ProjectProgressDoc>({ _id: { type: Number, required: true }, userId: { type: Number, required: true }, projectId: { type: Number, required: true }, status: { type: String, enum: PROGRESS_STATUSES, default: "NOT_STARTED" } }, { timestamps: { createdAt: false, updatedAt: true }, versionKey: false, id: false, collection: "project_progress" });
schema.index({ userId: 1, projectId: 1 }, { unique: true, name: "uk_project_progress_user_project" });
export const ProjectProgress = (mongoose.models.ProjectProgress as mongoose.Model<ProjectProgressDoc>) ?? mongoose.model<ProjectProgressDoc>("ProjectProgress", schema);

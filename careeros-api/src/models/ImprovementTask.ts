import mongoose, { Schema } from "mongoose";

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const TASK_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "OVERDUE",
  "REASSESSMENT_REQUIRED",
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface ImprovementTaskDoc {
  _id: number;
  planId: number;
  title: string;
  description?: string | null;
  skillId?: number | null;
  skillName?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  targetDate?: Date | null;
  ownerName?: string | null;
  baselineScore?: number | null;
  targetScore?: number | null;
  evidenceSource?: string | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ImprovementTaskDoc>(
  {
    _id: { type: Number, required: true },
    planId: { type: Number, required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 1000 },
    skillId: { type: Number, default: null },
    skillName: { type: String, default: null, maxlength: 120 },
    priority: { type: String, enum: TASK_PRIORITIES, required: true, default: "MEDIUM" },
    status: { type: String, enum: TASK_STATUSES, required: true, default: "NOT_STARTED" },
    targetDate: { type: Date, default: null },
    ownerName: { type: String, default: null, maxlength: 120 },
    baselineScore: { type: Number, default: null, min: 0, max: 100 },
    targetScore: { type: Number, default: null, min: 0, max: 100 },
    evidenceSource: { type: String, default: null, maxlength: 40 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, id: false },
);
schema.index({ planId: 1, targetDate: 1 }, { name: "idx_improvement_tasks_plan" });

export const ImprovementTask =
  (mongoose.models.ImprovementTask as mongoose.Model<ImprovementTaskDoc>) ??
  mongoose.model<ImprovementTaskDoc>("ImprovementTask", schema);

import mongoose, { Schema } from "mongoose";

export const PLAN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export interface ImprovementPlanDoc {
  _id: number;
  studentProfileId: number;
  userId: number;
  title: string;
  summary?: string | null;
  status: PlanStatus;
  targetCareerId?: number | null;
  targetCareerName?: string | null;
  createdByName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ImprovementPlanDoc>(
  {
    _id: { type: Number, required: true },
    studentProfileId: { type: Number, required: true },
    userId: { type: Number, required: true },
    title: { type: String, required: true, maxlength: 160 },
    summary: { type: String, default: null, maxlength: 1000 },
    status: { type: String, enum: PLAN_STATUSES, required: true, default: "ACTIVE" },
    targetCareerId: { type: Number, default: null },
    targetCareerName: { type: String, default: null, maxlength: 160 },
    createdByName: { type: String, default: null, maxlength: 120 },
  },
  { timestamps: true, versionKey: false, id: false },
);
schema.index({ studentProfileId: 1, updatedAt: -1 }, { name: "idx_improvement_plans_student" });

export const ImprovementPlan =
  (mongoose.models.ImprovementPlan as mongoose.Model<ImprovementPlanDoc>) ??
  mongoose.model<ImprovementPlanDoc>("ImprovementPlan", schema);

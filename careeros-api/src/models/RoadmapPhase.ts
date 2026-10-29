import mongoose, { Schema } from "mongoose";

export interface RoadmapPhaseDoc {
  _id: number;
  careerId: number;
  title: string;
  description?: string | null;
  displayOrder: number;
  durationDays: number;
  createdAt: Date;
}

const schema = new Schema<RoadmapPhaseDoc>({
  _id: { type: Number, required: true },
  careerId: { type: Number, required: true },
  title: { type: String, required: true, maxlength: 140 },
  description: { type: String, default: null, maxlength: 1000 },
  displayOrder: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, required: true, min: 0 },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, id: false });
schema.index({ careerId: 1, displayOrder: 1 }, { name: "idx_roadmap_phases_career_order" });

export const RoadmapPhase =
  (mongoose.models.RoadmapPhase as mongoose.Model<RoadmapPhaseDoc>) ??
  mongoose.model<RoadmapPhaseDoc>("RoadmapPhase", schema);

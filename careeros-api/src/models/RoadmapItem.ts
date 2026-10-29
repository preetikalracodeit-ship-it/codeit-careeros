import mongoose, { Schema } from "mongoose";

export interface RoadmapItemDoc {
  _id: number;
  phaseId: number;
  skillId?: number | null;
  title: string;
  description?: string | null;
  learningGoal?: string | null;
  displayOrder: number;
  estimatedHours: number;
  createdAt: Date;
}

const schema = new Schema<RoadmapItemDoc>({
  _id: { type: Number, required: true },
  phaseId: { type: Number, required: true },
  skillId: { type: Number, default: null },
  title: { type: String, required: true, maxlength: 180 },
  description: { type: String, default: null, maxlength: 1000 },
  learningGoal: { type: String, default: null, maxlength: 500 },
  displayOrder: { type: Number, required: true, min: 0 },
  estimatedHours: { type: Number, required: true, min: 0 },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, id: false });
schema.index({ phaseId: 1, displayOrder: 1 }, { name: "idx_roadmap_items_phase_order" });

export const RoadmapItem =
  (mongoose.models.RoadmapItem as mongoose.Model<RoadmapItemDoc>) ??
  mongoose.model<RoadmapItemDoc>("RoadmapItem", schema);

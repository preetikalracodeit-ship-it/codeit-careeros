import mongoose, { Schema } from "mongoose";

export interface ProjectDoc {
  _id: number;
  careerId: number;
  title: string;
  description?: string | null;
  difficulty: string;
  estimatedWeeks: number;
  displayOrder: number;
  published: boolean;
  createdAt: Date;
}

const schema = new Schema<ProjectDoc>({
  _id: { type: Number, required: true },
  careerId: { type: Number, required: true },
  title: { type: String, required: true, maxlength: 180 },
  description: { type: String, default: null, maxlength: 2000 },
  difficulty: { type: String, required: true, maxlength: 20 },
  estimatedWeeks: { type: Number, required: true, min: 0 },
  displayOrder: { type: Number, required: true, min: 0 },
  published: { type: Boolean, required: true, default: false },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, id: false });
schema.index({ careerId: 1, published: 1, displayOrder: 1 }, { name: "idx_projects_career_published_order" });

export const Project = (mongoose.models.Project as mongoose.Model<ProjectDoc>) ?? mongoose.model<ProjectDoc>("Project", schema);

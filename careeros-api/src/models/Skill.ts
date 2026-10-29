import mongoose, { Schema } from "mongoose";

export interface SkillDoc {
  _id: number;
  name: string;
  category: string;
  description?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const skillSchema = new Schema<SkillDoc>(
  {
    _id: { type: Number, required: true },
    name: { type: String, required: true, maxlength: 120, unique: true },
    category: { type: String, required: true, maxlength: 40 },
    description: { type: String, default: null, maxlength: 300 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false, id: false },
);
skillSchema.index({ category: 1 }, { name: "idx_skills_category" });

export const Skill =
  (mongoose.models.Skill as mongoose.Model<SkillDoc>) ??
  mongoose.model<SkillDoc>("Skill", skillSchema);

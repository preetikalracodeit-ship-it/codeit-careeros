import mongoose, { Schema } from "mongoose";

export const SKILL_CATEGORIES = [
  "PROGRAMMING_LANGUAGES",
  "FRAMEWORKS",
  "DATABASES",
  "CLOUD",
  "DEVOPS",
  "DATA",
  "AI_ML",
  "CYBERSECURITY",
  "TESTING",
  "SOFT_SKILLS",
  "OTHER",
] as const;

export interface SkillDoc {
  _id: number;
  name: string;
  category: (typeof SKILL_CATEGORIES)[number];
  description?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const skillSchema = new Schema<SkillDoc>(
  {
    _id: { type: Number, required: true },
    name: { type: String, required: true, unique: true, maxlength: 120 },
    category: { type: String, enum: SKILL_CATEGORIES, required: true },
    description: { type: String, default: null, maxlength: 300 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false, id: false, collection: "skills" },
);
skillSchema.index({ category: 1, active: 1, name: 1 }, { name: "idx_skills_category_active_name" });

export const Skill =
  (mongoose.models.Skill as mongoose.Model<SkillDoc>) ??
  mongoose.model<SkillDoc>("Skill", skillSchema);

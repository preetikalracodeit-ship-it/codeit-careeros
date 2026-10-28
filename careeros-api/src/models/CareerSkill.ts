import mongoose, { Schema } from "mongoose";

export const SKILL_LEVELS = ["BEGINNER", "BASIC", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

export interface CareerSkillDoc {
  _id: number;
  careerId: number;
  skillId: number;
  weightPercent: number;
  requiredLevel: (typeof SKILL_LEVELS)[number];
  targetPercent: number;
  createdAt: Date;
}

const careerSkillSchema = new Schema<CareerSkillDoc>(
  {
    _id: { type: Number, required: true },
    careerId: { type: Number, required: true },
    skillId: { type: Number, required: true },
    weightPercent: { type: Number, required: true, min: 0, max: 100 },
    requiredLevel: { type: String, enum: SKILL_LEVELS, required: true },
    targetPercent: { type: Number, required: true, min: 0, max: 100 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false, id: false, collection: "career_skills" },
);
careerSkillSchema.index({ careerId: 1, skillId: 1 }, { unique: true, name: "uk_career_skills_career_skill" });
careerSkillSchema.index({ careerId: 1, weightPercent: -1, _id: 1 }, { name: "idx_career_skills_order" });
careerSkillSchema.index({ skillId: 1 }, { name: "idx_career_skills_skill" });

export const CareerSkill =
  (mongoose.models.CareerSkill as mongoose.Model<CareerSkillDoc>) ??
  mongoose.model<CareerSkillDoc>("CareerSkill", careerSkillSchema);

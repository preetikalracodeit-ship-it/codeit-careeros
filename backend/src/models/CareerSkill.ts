import mongoose, { Schema } from "mongoose";

export interface CareerSkillDoc {
  _id: number;
  careerId: number;
  skillId: number;
  weightPercent: number;
  requiredLevel: string;
  targetPercent: number;
  createdAt: Date;
}

const careerSkillSchema = new Schema<CareerSkillDoc>(
  {
    _id: { type: Number, required: true },
    careerId: { type: Number, required: true },
    skillId: { type: Number, required: true },
    weightPercent: { type: Number, required: true, min: 0, max: 100 },
    requiredLevel: { type: String, required: true, maxlength: 20 },
    targetPercent: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, id: false },
);
careerSkillSchema.index({ careerId: 1, skillId: 1 }, { unique: true, name: "uk_career_skills_career_skill" });
careerSkillSchema.index({ careerId: 1, weightPercent: -1 }, { name: "idx_career_skills_weight" });

export const CareerSkill =
  (mongoose.models.CareerSkill as mongoose.Model<CareerSkillDoc>) ??
  mongoose.model<CareerSkillDoc>("CareerSkill", careerSkillSchema);

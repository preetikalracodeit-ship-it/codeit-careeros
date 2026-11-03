import mongoose, { Schema } from "mongoose";

export interface SkillScoreDoc {
  _id: number;
  attemptId: number;
  skillId: number;
  scorePercent: number;
  correctCount: number;
  questionCount: number;
  weightPercent: number;
  targetPercent: number;
  level: string;
}

const skillScoreSchema = new Schema<SkillScoreDoc>(
  {
    _id: { type: Number, required: true },
    attemptId: { type: Number, required: true },
    skillId: { type: Number, required: true },
    scorePercent: { type: Number, required: true, min: 0, max: 100 },
    correctCount: { type: Number, required: true, min: 0 },
    questionCount: { type: Number, required: true, min: 0 },
    weightPercent: { type: Number, required: true, min: 0, max: 100 },
    targetPercent: { type: Number, required: true, min: 0, max: 100 },
    level: { type: String, required: true, maxlength: 30 },
  },
  { versionKey: false, id: false },
);
skillScoreSchema.index({ attemptId: 1, weightPercent: -1 }, { name: "idx_skill_scores_attempt" });

export const SkillScore =
  (mongoose.models.SkillScore as mongoose.Model<SkillScoreDoc>) ??
  mongoose.model<SkillScoreDoc>("SkillScore", skillScoreSchema);

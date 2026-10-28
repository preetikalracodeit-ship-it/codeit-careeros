import mongoose, { Schema } from "mongoose";

export const RESULT_LEVELS = ["STRONG", "GOOD", "DEVELOPING", "NEEDS_IMPROVEMENT", "PRIORITY_GAP"] as const;
export type ResultLevel = (typeof RESULT_LEVELS)[number];

export interface SkillScoreDoc {
  _id: number;
  attemptId: number;
  skillId: number;
  scorePercent: number;
  correctCount: number;
  questionCount: number;
  weightPercent: number;
  targetPercent: number;
  level: ResultLevel;
}

const skillScoreSchema = new Schema<SkillScoreDoc>(
  {
    _id: { type: Number, required: true },
    attemptId: { type: Number, required: true },
    skillId: { type: Number, required: true },
    scorePercent: { type: Number, required: true, min: 0, max: 100 },
    correctCount: { type: Number, required: true, min: 0 },
    questionCount: { type: Number, required: true, min: 1 },
    weightPercent: { type: Number, required: true, min: 0, max: 100 },
    targetPercent: { type: Number, required: true, min: 0, max: 100 },
    level: { type: String, enum: RESULT_LEVELS, required: true },
  },
  { versionKey: false, id: false, collection: "skill_scores" },
);
skillScoreSchema.index({ attemptId: 1, skillId: 1 }, { unique: true, name: "uk_skill_scores_attempt_skill" });
skillScoreSchema.index({ attemptId: 1, weightPercent: -1 }, { name: "idx_skill_scores_attempt_weight" });
skillScoreSchema.index({ skillId: 1 }, { name: "idx_skill_scores_skill" });

export const SkillScore =
  (mongoose.models.SkillScore as mongoose.Model<SkillScoreDoc>) ??
  mongoose.model<SkillScoreDoc>("SkillScore", skillScoreSchema);

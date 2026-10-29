import mongoose, { Schema } from "mongoose";

export interface AssessmentQuestionDoc {
  _id: number;
  assessmentId: number;
  skillId: number;
  questionText: string;
  difficulty: string;
  displayOrder: number;
  explanation?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentQuestionSchema = new Schema<AssessmentQuestionDoc>(
  {
    _id: { type: Number, required: true },
    assessmentId: { type: Number, required: true },
    skillId: { type: Number, required: true },
    questionText: { type: String, required: true },
    difficulty: { type: String, required: true, maxlength: 20 },
    displayOrder: { type: Number, required: true, min: 0 },
    explanation: { type: String, default: null },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false, id: false },
);
assessmentQuestionSchema.index({ assessmentId: 1, active: 1 }, { name: "idx_questions_assessment_active" });

export const AssessmentQuestion =
  (mongoose.models.AssessmentQuestion as mongoose.Model<AssessmentQuestionDoc>) ??
  mongoose.model<AssessmentQuestionDoc>("AssessmentQuestion", assessmentQuestionSchema);

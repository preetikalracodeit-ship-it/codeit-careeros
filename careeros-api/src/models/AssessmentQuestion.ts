import mongoose, { Schema } from "mongoose";

export const QUESTION_DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export const QUESTION_TYPES = ["MCQ"] as const;

export interface AssessmentQuestionDoc {
  _id: number;
  assessmentId: number;
  skillId: number;
  questionText: string;
  questionType: (typeof QUESTION_TYPES)[number];
  difficulty: (typeof QUESTION_DIFFICULTIES)[number];
  explanation?: string | null;
  displayOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentQuestionSchema = new Schema<AssessmentQuestionDoc>(
  {
    _id: { type: Number, required: true },
    assessmentId: { type: Number, required: true },
    skillId: { type: Number, required: true },
    questionText: { type: String, required: true, maxlength: 1000 },
    questionType: { type: String, enum: QUESTION_TYPES, required: true, default: "MCQ" },
    difficulty: { type: String, enum: QUESTION_DIFFICULTIES, required: true },
    explanation: { type: String, default: null, maxlength: 600 },
    displayOrder: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false, id: false, collection: "assessment_questions" },
);
assessmentQuestionSchema.index({ assessmentId: 1, active: 1, displayOrder: 1 }, { name: "idx_questions_assessment_active_order" });
assessmentQuestionSchema.index({ skillId: 1, active: 1 }, { name: "idx_questions_skill_active" });

export const AssessmentQuestion =
  (mongoose.models.AssessmentQuestion as mongoose.Model<AssessmentQuestionDoc>) ??
  mongoose.model<AssessmentQuestionDoc>("AssessmentQuestion", assessmentQuestionSchema);

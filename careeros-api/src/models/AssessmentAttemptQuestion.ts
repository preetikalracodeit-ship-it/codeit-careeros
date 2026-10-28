import mongoose, { Schema } from "mongoose";

export interface AssessmentAttemptQuestionDoc {
  _id: number;
  attemptId: number;
  questionId: number;
  displayOrder: number;
}

const assessmentAttemptQuestionSchema = new Schema<AssessmentAttemptQuestionDoc>(
  {
    _id: { type: Number, required: true },
    attemptId: { type: Number, required: true },
    questionId: { type: Number, required: true },
    displayOrder: { type: Number, required: true, min: 0 },
  },
  { versionKey: false, id: false, collection: "assessment_attempt_questions" },
);
assessmentAttemptQuestionSchema.index({ attemptId: 1, questionId: 1 }, { unique: true, name: "uk_attempt_questions_attempt_question" });
assessmentAttemptQuestionSchema.index({ attemptId: 1, displayOrder: 1 }, { name: "idx_attempt_questions_attempt_order" });
assessmentAttemptQuestionSchema.index({ questionId: 1 }, { name: "idx_attempt_questions_question" });

export const AssessmentAttemptQuestion =
  (mongoose.models.AssessmentAttemptQuestion as mongoose.Model<AssessmentAttemptQuestionDoc>) ??
  mongoose.model<AssessmentAttemptQuestionDoc>("AssessmentAttemptQuestion", assessmentAttemptQuestionSchema);

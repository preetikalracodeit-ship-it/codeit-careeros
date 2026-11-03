import mongoose, { Schema } from "mongoose";

export interface AssessmentAttemptQuestionDoc {
  _id: number;
  attemptId: number;
  questionId: number;
  displayOrder: number;
}

const schema = new Schema<AssessmentAttemptQuestionDoc>(
  {
    _id: { type: Number, required: true },
    attemptId: { type: Number, required: true },
    questionId: { type: Number, required: true },
    displayOrder: { type: Number, required: true },
  },
  { versionKey: false, id: false },
);
schema.index({ attemptId: 1, questionId: 1 }, { unique: true, name: "uk_attempt_questions_attempt_question" });
schema.index({ attemptId: 1, displayOrder: 1 }, { name: "idx_attempt_questions_order" });

export const AssessmentAttemptQuestion =
  (mongoose.models.AssessmentAttemptQuestion as mongoose.Model<AssessmentAttemptQuestionDoc>) ??
  mongoose.model<AssessmentAttemptQuestionDoc>("AssessmentAttemptQuestion", schema);

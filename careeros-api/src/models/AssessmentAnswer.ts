import mongoose, { Schema } from "mongoose";

export interface AssessmentAnswerDoc {
  _id: number;
  attemptId: number;
  questionId: number;
  selectedOptionId: number;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentAnswerSchema = new Schema<AssessmentAnswerDoc>(
  {
    _id: { type: Number, required: true },
    attemptId: { type: Number, required: true },
    questionId: { type: Number, required: true },
    selectedOptionId: { type: Number, required: true },
  },
  { timestamps: true, versionKey: false, id: false, collection: "assessment_answers" },
);
assessmentAnswerSchema.index({ attemptId: 1, questionId: 1 }, { unique: true, name: "uk_answers_attempt_question" });

export const AssessmentAnswer =
  (mongoose.models.AssessmentAnswer as mongoose.Model<AssessmentAnswerDoc>) ??
  mongoose.model<AssessmentAnswerDoc>("AssessmentAnswer", assessmentAnswerSchema);

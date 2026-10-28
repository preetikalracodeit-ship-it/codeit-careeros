import mongoose, { Schema } from "mongoose";

export interface QuestionOptionDoc {
  _id: number;
  questionId: number;
  optionText: string;
  correct: boolean;
  displayOrder: number;
}

const questionOptionSchema = new Schema<QuestionOptionDoc>(
  {
    _id: { type: Number, required: true },
    questionId: { type: Number, required: true },
    optionText: { type: String, required: true, maxlength: 500 },
    correct: { type: Boolean, required: true, default: false },
    displayOrder: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, id: false, collection: "question_options" },
);
questionOptionSchema.index({ questionId: 1, displayOrder: 1 }, { name: "idx_options_question_order" });

export const QuestionOption =
  (mongoose.models.QuestionOption as mongoose.Model<QuestionOptionDoc>) ??
  mongoose.model<QuestionOptionDoc>("QuestionOption", questionOptionSchema);

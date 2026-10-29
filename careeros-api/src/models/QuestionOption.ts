import mongoose, { Schema } from "mongoose";

export interface QuestionOptionDoc {
  _id: number;
  questionId: number;
  optionText: string;
  correct: boolean;
  displayOrder: number;
}

const schema = new Schema<QuestionOptionDoc>(
  {
    _id: { type: Number, required: true },
    questionId: { type: Number, required: true },
    optionText: { type: String, required: true, maxlength: 500 },
    correct: { type: Boolean, required: true },
    displayOrder: { type: Number, required: true },
  },
  { versionKey: false, id: false },
);
schema.index({ questionId: 1, displayOrder: 1 }, { name: "idx_options_question" });

export const QuestionOption =
  (mongoose.models.QuestionOption as mongoose.Model<QuestionOptionDoc>) ??
  mongoose.model<QuestionOptionDoc>("QuestionOption", schema);

import mongoose, { Schema } from "mongoose";

export interface AssessmentTestDoc {
  _id: number;
  careerId: number;
  title: string;
  description?: string | null;
  durationMinutes: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentTestSchema = new Schema<AssessmentTestDoc>(
  {
    _id: { type: Number, required: true },
    careerId: { type: Number, required: true },
    title: { type: String, required: true, maxlength: 150 },
    description: { type: String, default: null, maxlength: 500 },
    durationMinutes: { type: Number, required: true, min: 1 },
    published: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, versionKey: false, id: false },
);
assessmentTestSchema.index({ careerId: 1 }, { name: "idx_assessments_career" });

export const AssessmentTest =
  (mongoose.models.AssessmentTest as mongoose.Model<AssessmentTestDoc>) ??
  mongoose.model<AssessmentTestDoc>("AssessmentTest", assessmentTestSchema);

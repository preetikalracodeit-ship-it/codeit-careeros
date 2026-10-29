import mongoose, { Schema } from "mongoose";

export interface AssessmentAttemptDoc {
  _id: number;
  attemptCode: string;
  userId: number;
  assessmentId: number;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date | null;
  totalQuestions: number;
  answeredCount: number;
  overallScore?: number | null;
  createdAt: Date;
}

const assessmentAttemptSchema = new Schema<AssessmentAttemptDoc>(
  {
    _id: { type: Number, required: true },
    attemptCode: { type: String, required: true, maxlength: 40, unique: true },
    userId: { type: Number, required: true },
    assessmentId: { type: Number, required: true },
    status: { type: String, required: true, maxlength: 20 },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    totalQuestions: { type: Number, required: true, min: 0 },
    answeredCount: { type: Number, required: true, min: 0, default: 0 },
    overallScore: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, id: false },
);
assessmentAttemptSchema.index({ userId: 1, status: 1, startedAt: -1 }, { name: "idx_attempts_user_status_started" });
assessmentAttemptSchema.index({ assessmentId: 1 }, { name: "idx_attempts_assessment" });

export const AssessmentAttempt =
  (mongoose.models.AssessmentAttempt as mongoose.Model<AssessmentAttemptDoc>) ??
  mongoose.model<AssessmentAttemptDoc>("AssessmentAttempt", assessmentAttemptSchema);

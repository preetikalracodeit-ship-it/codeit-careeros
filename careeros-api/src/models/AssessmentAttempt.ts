import mongoose, { Schema } from "mongoose";

export const ATTEMPT_STATUSES = ["IN_PROGRESS", "SUBMITTED", "EXPIRED"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export interface AssessmentAttemptDoc {
  _id: number;
  attemptCode: string;
  userId: number;
  assessmentId: number;
  status: AttemptStatus;
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
    attemptCode: { type: String, required: true, unique: true, maxlength: 40 },
    userId: { type: Number, required: true },
    assessmentId: { type: Number, required: true },
    status: { type: String, enum: ATTEMPT_STATUSES, required: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    totalQuestions: { type: Number, required: true, min: 0 },
    answeredCount: { type: Number, required: true, default: 0, min: 0 },
    overallScore: { type: Number, default: null, min: 0, max: 100 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, id: false, collection: "assessment_attempts" },
);
assessmentAttemptSchema.index({ userId: 1, startedAt: -1 }, { name: "idx_attempts_user_started" });
assessmentAttemptSchema.index({ userId: 1, assessmentId: 1, startedAt: -1 }, { name: "idx_attempts_user_assessment_started" });
assessmentAttemptSchema.index(
  { userId: 1, assessmentId: 1 },
  { unique: true, partialFilterExpression: { status: "IN_PROGRESS" }, name: "uk_attempts_one_active_per_assessment" },
);
assessmentAttemptSchema.index({ status: 1, startedAt: -1 }, { name: "idx_attempts_status_started" });

export const AssessmentAttempt =
  (mongoose.models.AssessmentAttempt as mongoose.Model<AssessmentAttemptDoc>) ??
  mongoose.model<AssessmentAttemptDoc>("AssessmentAttempt", assessmentAttemptSchema);

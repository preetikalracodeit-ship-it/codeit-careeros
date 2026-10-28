import mongoose, { Schema } from "mongoose";

export type AuditOutcome = "SUCCESS" | "DENIED" | "ERROR" | "FAILURE";

export interface AuditEventDoc {
  _id: number;
  actorUserId?: number | null;
  actorRole?: string | null;
  action: string;
  targetPath: string;
  outcome: AuditOutcome;
  httpStatus?: number | null;
  requestId?: string | null;
  actorEmail?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  institutionId?: number | null;
  scopeDescription?: string | null;
  details?: string | null;
  createdAt: Date;
}

const auditEventSchema = new Schema<AuditEventDoc>(
  {
    _id: { type: Number, required: true },
    actorUserId: { type: Number, default: null },
    actorRole: { type: String, default: null, maxlength: 20 },
    action: { type: String, required: true, maxlength: 140 },
    targetPath: { type: String, required: true, maxlength: 255 },
    outcome: {
      type: String,
      required: true,
      enum: ["SUCCESS", "DENIED", "ERROR", "FAILURE"],
    },
    httpStatus: { type: Number, default: null },
    requestId: { type: String, default: null, maxlength: 64 },
    actorEmail: { type: String, default: null, maxlength: 190 },
    targetType: { type: String, default: null, maxlength: 60 },
    targetId: { type: String, default: null, maxlength: 80 },
    institutionId: { type: Number, default: null },
    scopeDescription: { type: String, default: null, maxlength: 200 },
    details: { type: String, default: null, maxlength: 1000 },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false, collection: "audit_events" },
);

auditEventSchema.index({ createdAt: 1 });
auditEventSchema.index({ actorUserId: 1 });
auditEventSchema.index({ action: 1 });
auditEventSchema.index({ institutionId: 1, createdAt: -1 });

const APPEND_ONLY =
  "audit_events is append-only; existing audit records cannot be changed";

const rejectMutation = async function (): Promise<void> {
  throw new Error(APPEND_ONLY);
};

auditEventSchema.pre(
  /^(updateOne|updateMany|findOneAndUpdate|replaceOne|deleteOne|deleteMany|findOneAndDelete)$/,
  rejectMutation,
);

export const AuditEvent =
  (mongoose.models.AuditEvent as mongoose.Model<AuditEventDoc>) ??
  mongoose.model<AuditEventDoc>("AuditEvent", auditEventSchema);

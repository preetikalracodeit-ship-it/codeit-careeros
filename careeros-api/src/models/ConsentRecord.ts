import mongoose, { Schema } from "mongoose";

export const CONSENT_TYPES = ["TERMS_AND_PRIVACY"] as const;
export const CONSENT_METHODS = [
  "PASSWORD_REGISTRATION",
  "GOOGLE_REGISTRATION",
  "RECONSENT",
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

export const EVIDENCE_REGISTRATION_CHECKBOX = "explicit_registration_checkbox";
export const EVIDENCE_GOOGLE_SIGNUP_BUTTON = "explicit_google_signup_button";
export const EVIDENCE_AUTHENTICATED_CONSENT = "authenticated_consent_request";

export interface ConsentRecordDoc {
  _id: number;
  userId: number;
  consentType: ConsentType;
  policyVersion: string;
  method: ConsentMethod;
  evidence: string;
  acceptedAt: Date;
}

const consentRecordSchema = new Schema<ConsentRecordDoc>(
  {
    _id: { type: Number, required: true },
    userId: { type: Number, required: true },
    consentType: { type: String, enum: CONSENT_TYPES, required: true },
    policyVersion: { type: String, required: true, maxlength: 40 },
    method: { type: String, enum: CONSENT_METHODS, required: true },
    evidence: { type: String, required: true, maxlength: 60 },
    acceptedAt: { type: Date, required: true },
  },
  {
    versionKey: false,
    id: false,
    timestamps: false,
  },
);

consentRecordSchema.index(
  { userId: 1, consentType: 1, policyVersion: 1 },
  { unique: true, name: "uk_consent_user_type_version" },
);
consentRecordSchema.index({ policyVersion: 1 }, { name: "idx_consent_version" });

export const ConsentRecord =
  (mongoose.models.ConsentRecord as mongoose.Model<ConsentRecordDoc>) ??
  mongoose.model<ConsentRecordDoc>("ConsentRecord", consentRecordSchema);

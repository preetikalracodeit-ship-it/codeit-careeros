import mongoose, { Schema } from "mongoose";

export const APPLICATION_STAGES = [
  "REGISTERED",
  "APPLIED",
  "ASSESSMENT",
  "TECHNICAL_INTERVIEW",
  "HR_INTERVIEW",
  "OFFERED",
  "JOINED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const OFFER_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "JOINED", "WITHDRAWN"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export interface PlacementStageEventDoc {
  id: number;
  stage: ApplicationStage;
  note?: string | null;
  recordedAt: Date;
}

export interface PlacementOfferDoc {
  id: number;
  packageAmount?: number | null;
  currency?: string | null;
  offerDate?: Date | null;
  status: OfferStatus;
  joinedAt?: Date | null;
  notes?: string | null;
}

export interface PlacementApplicationDoc {
  _id: number;
  driveId: number;
  userId: number;
  studentProfileId: number;
  collegeId?: number | null;
  stage: ApplicationStage;
  eligibilityOverride: boolean;
  overrideReason?: string | null;
  appliedAt: Date;
  history: PlacementStageEventDoc[];
  offer?: PlacementOfferDoc | null;
  createdAt: Date;
  updatedAt: Date;
}

const stageEventSchema = new Schema<PlacementStageEventDoc>(
  {
    id: { type: Number, required: true },
    stage: { type: String, enum: APPLICATION_STAGES, required: true },
    note: { type: String, default: null, maxlength: 500 },
    recordedAt: { type: Date, required: true },
  },
  { _id: false },
);

const offerSchema = new Schema<PlacementOfferDoc>(
  {
    id: { type: Number, required: true },
    packageAmount: { type: Number, default: null, min: 0 },
    currency: { type: String, default: null, maxlength: 10 },
    offerDate: { type: Date, default: null },
    status: { type: String, enum: OFFER_STATUSES, required: true, default: "PENDING" },
    joinedAt: { type: Date, default: null },
    notes: { type: String, default: null, maxlength: 1000 },
  },
  { _id: false },
);

const schema = new Schema<PlacementApplicationDoc>(
  {
    _id: { type: Number, required: true },
    driveId: { type: Number, required: true },
    userId: { type: Number, required: true },
    studentProfileId: { type: Number, required: true },
    collegeId: { type: Number, default: null },
    stage: { type: String, enum: APPLICATION_STAGES, required: true, default: "REGISTERED" },
    eligibilityOverride: { type: Boolean, required: true, default: false },
    overrideReason: { type: String, default: null, maxlength: 500 },
    appliedAt: { type: Date, required: true },
    history: { type: [stageEventSchema], default: [] },
    offer: { type: offerSchema, default: null },
  },
  { timestamps: true, versionKey: false, id: false },
);
schema.index({ driveId: 1, studentProfileId: 1 }, { name: "uk_placement_app_drive_student" });
schema.index({ studentProfileId: 1, appliedAt: -1 }, { name: "idx_placement_app_student" });

export const PlacementApplication =
  (mongoose.models.PlacementApplication as mongoose.Model<PlacementApplicationDoc>) ??
  mongoose.model<PlacementApplicationDoc>("PlacementApplication", schema);

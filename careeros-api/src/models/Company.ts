import mongoose, { Schema } from "mongoose";

export const COMPANY_STATUSES = ["PROSPECT", "ACTIVE", "PAUSED", "BLOCKED"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export interface CompanyDoc {
  _id: number;
  institutionId: number;
  name: string;
  industry?: string | null;
  sector?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  recruitmentStatus: CompanyStatus;
  source?: string | null;
  notes?: string | null;
  createdBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CompanyDoc>(
  {
    _id: { type: Number, required: true },
    institutionId: { type: Number, required: true },
    name: { type: String, required: true, maxlength: 180 },
    industry: { type: String, default: null, maxlength: 120 },
    sector: { type: String, default: null, maxlength: 120 },
    website: { type: String, default: null, maxlength: 250 },
    contactName: { type: String, default: null, maxlength: 120 },
    contactEmail: { type: String, default: null, maxlength: 190 },
    contactPhone: { type: String, default: null, maxlength: 30 },
    recruitmentStatus: { type: String, enum: COMPANY_STATUSES, required: true, default: "PROSPECT" },
    source: { type: String, default: null, maxlength: 120 },
    notes: { type: String, default: null, maxlength: 1000 },
    createdBy: { type: Number, default: null },
  },
  { timestamps: true, versionKey: false, id: false, collection: "placement_companies" },
);
schema.index({ institutionId: 1, name: 1 }, { unique: true, name: "uk_companies_institution_name" });

export const Company =
  (mongoose.models.Company as mongoose.Model<CompanyDoc>) ??
  mongoose.model<CompanyDoc>("Company", schema);

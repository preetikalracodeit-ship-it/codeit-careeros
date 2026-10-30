import mongoose, { Schema } from "mongoose";

export const JOB_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;
export const EMPLOYMENT_TYPES = ["FULL_TIME", "INTERNSHIP", "PART_TIME", "CONTRACT"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export interface JobOpeningDoc {
  _id: number;
  institutionId: number;
  companyId: number;
  title: string;
  description?: string | null;
  requiredSkills?: string | null;
  location?: string | null;
  employmentType?: EmploymentType | null;
  eligibilityCriteria?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  applicationDeadline?: string | null;
  status: JobStatus;
  createdBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<JobOpeningDoc>(
  {
    _id: { type: Number, required: true },
    institutionId: { type: Number, required: true },
    companyId: { type: Number, required: true },
    title: { type: String, required: true, maxlength: 180 },
    description: { type: String, default: null, maxlength: 4000 },
    requiredSkills: { type: String, default: null, maxlength: 1000 },
    location: { type: String, default: null, maxlength: 160 },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: null },
    eligibilityCriteria: { type: String, default: null, maxlength: 2000 },
    salaryMin: { type: Number, default: null, min: 0 },
    salaryMax: { type: Number, default: null, min: 0 },
    currency: { type: String, default: null, maxlength: 10 },
    applicationDeadline: { type: String, default: null },
    status: { type: String, enum: JOB_STATUSES, required: true, default: "DRAFT" },
    createdBy: { type: Number, default: null },
  },
  { timestamps: true, versionKey: false, id: false, collection: "placement_jobs" },
);
schema.index({ institutionId: 1, status: 1, createdAt: -1 }, { name: "idx_jobs_institution_status" });
schema.index({ companyId: 1 }, { name: "idx_jobs_company" });

export const JobOpening =
  (mongoose.models.JobOpening as mongoose.Model<JobOpeningDoc>) ??
  mongoose.model<JobOpeningDoc>("JobOpening", schema);

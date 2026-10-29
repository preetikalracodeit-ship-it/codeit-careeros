import mongoose, { Schema } from "mongoose";

export const COLLEGE_STATUSES = ["ACTIVE", "SUSPENDED", "ONBOARDING"] as const;
export type CollegeStatus = (typeof COLLEGE_STATUSES)[number];

export interface DepartmentDoc {
  id: number;
  name: string;
  code: string;
  hodName?: string | null;
}

export interface BatchDoc {
  id: number;
  name: string;
  departmentId: number;
  year: number;
}

export interface CollegeDoc {
  _id: number;
  name: string;
  code: string;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  status: CollegeStatus;
  departments: DepartmentDoc[];
  batches: BatchDoc[];
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<DepartmentDoc>(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true, maxlength: 120 },
    code: { type: String, required: true, maxlength: 24 },
    hodName: { type: String, default: null, maxlength: 120 },
  },
  { _id: false },
);

const batchSchema = new Schema<BatchDoc>(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true, maxlength: 80 },
    departmentId: { type: Number, required: true },
    year: { type: Number, required: true },
  },
  { _id: false },
);

const collegeSchema = new Schema<CollegeDoc>(
  {
    _id: { type: Number, required: true },
    name: { type: String, required: true, maxlength: 160 },
    code: { type: String, required: true, unique: true, maxlength: 32 },
    city: { type: String, default: null, maxlength: 120 },
    state: { type: String, default: null, maxlength: 120 },
    website: { type: String, default: null, maxlength: 200 },
    contactEmail: { type: String, default: null, maxlength: 190 },
    status: { type: String, enum: COLLEGE_STATUSES, required: true, default: "ONBOARDING" },
    departments: { type: [departmentSchema], default: [] },
    batches: { type: [batchSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

collegeSchema.index({ status: 1 }, { name: "idx_colleges_status" });

export const College =
  (mongoose.models.College as mongoose.Model<CollegeDoc>) ??
  mongoose.model<CollegeDoc>("College", collegeSchema);

import mongoose, { Schema } from "mongoose";

export const DRIVE_STATUSES = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
] as const;
export type DriveStatus = (typeof DRIVE_STATUSES)[number];

export interface PlacementDriveDoc {
  _id: number;
  institutionId?: number | null;
  collegeId?: number | null;
  companyId?: number | null;
  jobId?: number | null;
  name: string;
  companyName: string;
  jobTitle: string;
  location?: string | null;
  description?: string | null;
  eligibilityCriteria?: string | null;
  registrationStart?: Date | null;
  registrationEnd?: Date | null;
  driveDate?: Date | null;
  eligibleDepartmentId?: number | null;
  eligibleProgramId?: number | null;
  eligibleBatchId?: number | null;
  eligibleGraduationYear?: number | null;
  minimumReadinessPercent?: number | null;
  status: DriveStatus;
  createdBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<PlacementDriveDoc>(
  {
    _id: { type: Number, required: true },
    institutionId: { type: Number, default: null },
    collegeId: { type: Number, default: null },
    companyId: { type: Number, default: null },
    jobId: { type: Number, default: null },
    name: { type: String, required: true, maxlength: 180 },
    companyName: { type: String, required: true, maxlength: 160 },
    jobTitle: { type: String, required: true, maxlength: 160 },
    location: { type: String, default: null, maxlength: 160 },
    description: { type: String, default: null, maxlength: 2000 },
    eligibilityCriteria: { type: String, default: null, maxlength: 2000 },
    registrationStart: { type: Date, default: null },
    registrationEnd: { type: Date, default: null },
    driveDate: { type: Date, default: null },
    eligibleDepartmentId: { type: Number, default: null },
    eligibleProgramId: { type: Number, default: null },
    eligibleBatchId: { type: Number, default: null },
    eligibleGraduationYear: { type: Number, default: null },
    minimumReadinessPercent: { type: Number, default: null, min: 0, max: 100 },
    status: { type: String, enum: DRIVE_STATUSES, required: true, default: "DRAFT" },
    createdBy: { type: Number, default: null },
  },
  { timestamps: true, versionKey: false, id: false },
);
schema.index({ institutionId: 1, status: 1, createdAt: -1 }, { name: "idx_placement_drives_institution_status" });
schema.index({ collegeId: 1, status: 1, createdAt: -1 }, { name: "idx_placement_drives_college_status" });

export const PlacementDrive =
  (mongoose.models.PlacementDrive as mongoose.Model<PlacementDriveDoc>) ??
  mongoose.model<PlacementDriveDoc>("PlacementDrive", schema);

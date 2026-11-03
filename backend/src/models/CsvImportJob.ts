import mongoose, { Schema } from "mongoose";

export const IMPORT_JOB_STATUSES = ["PREVIEW", "COMMITTING", "COMMITTED", "FAILED"] as const;
export const IMPORT_ROW_STATUSES = ["READY", "CREATED", "LINKED", "SKIPPED", "REJECTED"] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export interface CsvImportRowDoc {
  rowNumber: number;
  fullName?: string | null;
  email?: string | null;
  mobile?: string | null;
  rollNumber?: string | null;
  departmentCode?: string | null;
  programCode?: string | null;
  batchLabel?: string | null;
  sectionName?: string | null;
  academicYearLabel?: string | null;
  status: ImportRowStatus;
  message?: string | null;
}

export interface CsvImportJobDoc {
  _id: number;
  institutionId: number;
  createdBy: number;
  status: ImportJobStatus;
  originalFilename?: string | null;
  fileHash?: string | null;
  totalRows: number;
  createdRows: number;
  linkedRows: number;
  skippedRows: number;
  rejectedRows: number;
  rows: CsvImportRowDoc[];
  completedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

const rowSchema = new Schema<CsvImportRowDoc>(
  {
    rowNumber: { type: Number, required: true },
    fullName: { type: String, default: null, maxlength: 120 },
    email: { type: String, default: null, maxlength: 190 },
    mobile: { type: String, default: null, maxlength: 20 },
    rollNumber: { type: String, default: null, maxlength: 40 },
    departmentCode: { type: String, default: null, maxlength: 40 },
    programCode: { type: String, default: null, maxlength: 40 },
    batchLabel: { type: String, default: null, maxlength: 40 },
    sectionName: { type: String, default: null, maxlength: 40 },
    academicYearLabel: { type: String, default: null, maxlength: 40 },
    status: { type: String, enum: IMPORT_ROW_STATUSES, required: true },
    message: { type: String, default: null, maxlength: 500 },
  },
  { _id: false },
);

const schema = new Schema<CsvImportJobDoc>(
  {
    _id: { type: Number, required: true },
    institutionId: { type: Number, required: true },
    createdBy: { type: Number, required: true },
    status: { type: String, enum: IMPORT_JOB_STATUSES, required: true, default: "PREVIEW" },
    originalFilename: { type: String, default: null, maxlength: 255 },
    fileHash: { type: String, default: null, maxlength: 64 },
    totalRows: { type: Number, required: true, default: 0 },
    createdRows: { type: Number, required: true, default: 0 },
    linkedRows: { type: Number, required: true, default: 0 },
    skippedRows: { type: Number, required: true, default: 0 },
    rejectedRows: { type: Number, required: true, default: 0 },
    rows: { type: [rowSchema], default: [] },
    completedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, id: false, collection: "csv_import_jobs" },
);
schema.index({ institutionId: 1, createdAt: -1 }, { name: "idx_csv_import_jobs_institution" });
schema.index({ status: 1 }, { name: "idx_csv_import_jobs_status" });
schema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: "PREVIEW" }, name: "ttl_csv_import_previews" },
);

export const CsvImportJob =
  (mongoose.models.CsvImportJob as mongoose.Model<CsvImportJobDoc>) ??
  mongoose.model<CsvImportJobDoc>("CsvImportJob", schema);

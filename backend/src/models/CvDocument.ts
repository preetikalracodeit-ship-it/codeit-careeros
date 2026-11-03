import mongoose, { Schema } from "mongoose";

export const CV_STATUSES = ["PARSED", "FAILED"] as const;
export type CvStatus = (typeof CV_STATUSES)[number];

export interface CvDocumentDoc {
  _id: number;
  userId: number;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  status: CvStatus;
  parseError?: string | null;
  candidateName?: string | null;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  extractedText?: string | null;
  fileData?: Buffer;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CvDocumentDoc>(
  {
    _id: { type: Number, required: true },
    userId: { type: Number, required: true, unique: true },
    originalFilename: { type: String, required: true, maxlength: 200 },
    contentType: { type: String, required: true, maxlength: 120 },
    fileSize: { type: Number, required: true, min: 0 },
    status: { type: String, enum: CV_STATUSES, required: true },
    parseError: { type: String, default: null, maxlength: 500 },
    candidateName: { type: String, default: null, maxlength: 120 },
    candidateEmail: { type: String, default: null, maxlength: 160 },
    candidatePhone: { type: String, default: null, maxlength: 40 },
    extractedText: { type: String, default: null },
    fileData: { type: Buffer, select: false },
    uploadedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false, id: false },
);

export const CvDocument =
  (mongoose.models.CvDocument as mongoose.Model<CvDocumentDoc>) ??
  mongoose.model<CvDocumentDoc>("CvDocument", schema);

import mongoose, { Schema } from "mongoose";
export const INSTITUTION_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type InstitutionStatus = (typeof INSTITUTION_STATUSES)[number];
export interface InstitutionDoc { _id: number; code: string; name: string; status: InstitutionStatus; timezone?: string | null; contactEmail?: string | null; createdAt: Date; updatedAt: Date; }
const schema = new Schema<InstitutionDoc>({ _id: { type: Number, required: true }, code: { type: String, required: true, maxlength: 40 }, name: { type: String, required: true, maxlength: 160 }, status: { type: String, enum: INSTITUTION_STATUSES, default: "ACTIVE", required: true }, timezone: { type: String, default: null, maxlength: 60 }, contactEmail: { type: String, default: null, maxlength: 190 } }, { timestamps: true, versionKey: false, id: false, collection: "institutions" });
schema.index({ code: 1 }, { unique: true, name: "uk_institutions_code" });
export const Institution = (mongoose.models.Institution as mongoose.Model<InstitutionDoc>) ?? mongoose.model<InstitutionDoc>("Institution", schema);

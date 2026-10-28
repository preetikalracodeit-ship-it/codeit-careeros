import mongoose, { Schema } from "mongoose";
export interface SectionDoc { _id: number; batchId: number; name: string; status: "ACTIVE" | "INACTIVE"; }
const schema = new Schema<SectionDoc>({ _id: { type: Number, required: true }, batchId: { type: Number, required: true }, name: { type: String, required: true, maxlength: 40 }, status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" } }, { timestamps: true, versionKey: false, id: false, collection: "sections" }); schema.index({ batchId: 1, name: 1 }, { unique: true, name: "uk_sections_batch_name" });
export const Section = (mongoose.models.Section as mongoose.Model<SectionDoc>) ?? mongoose.model<SectionDoc>("Section", schema);

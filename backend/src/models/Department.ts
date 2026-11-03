import mongoose, { Schema } from "mongoose";
export interface DepartmentDoc { _id: number; institutionId: number; code: string; name: string; status: "ACTIVE" | "INACTIVE"; createdAt: Date; updatedAt: Date; }
const schema = new Schema<DepartmentDoc>({ _id: { type: Number, required: true }, institutionId: { type: Number, required: true }, code: { type: String, required: true, maxlength: 40 }, name: { type: String, required: true, maxlength: 160 }, status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" } }, { timestamps: true, versionKey: false, id: false, collection: "departments" }); schema.index({ institutionId: 1, code: 1 }, { unique: true, name: "uk_departments_institution_code" });
export const Department = (mongoose.models.Department as mongoose.Model<DepartmentDoc>) ?? mongoose.model<DepartmentDoc>("Department", schema);


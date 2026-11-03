import mongoose, { Schema } from "mongoose";

export interface AcademicYearDoc {
  _id: number;
  institutionId: number;
  label: string;
  startDate?: string | null;
  endDate?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<AcademicYearDoc>(
  {
    _id: { type: Number, required: true },
    institutionId: { type: Number, required: true },
    label: { type: String, required: true, maxlength: 40 },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    active: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, versionKey: false, id: false, collection: "academic_years" },
);
schema.index({ institutionId: 1, label: 1 }, { unique: true, name: "uk_academic_years_institution_label" });

export const AcademicYear =
  (mongoose.models.AcademicYear as mongoose.Model<AcademicYearDoc>) ??
  mongoose.model<AcademicYearDoc>("AcademicYear", schema);

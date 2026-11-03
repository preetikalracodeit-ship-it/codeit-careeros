import mongoose, { Schema } from "mongoose";

export const ENROLLMENT_STATUSES = ["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export interface StudentEnrollmentDoc {
  _id: number;
  studentProfileId: number;
  institutionId: number;
  departmentId: number;
  programId: number;
  batchId: number;
  sectionId?: number | null;
  rollNumber: string;
  status: EnrollmentStatus;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<StudentEnrollmentDoc>(
  {
    _id: { type: Number, required: true },
    studentProfileId: { type: Number, required: true },
    institutionId: { type: Number, required: true },
    departmentId: { type: Number, required: true },
    programId: { type: Number, required: true },
    batchId: { type: Number, required: true },
    sectionId: { type: Number, default: null },
    rollNumber: { type: String, required: true, maxlength: 40 },
    status: { type: String, enum: ENROLLMENT_STATUSES, required: true, default: "ACTIVE" },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
  },
  { timestamps: true, versionKey: false, id: false, collection: "student_enrollments" },
);
schema.index({ institutionId: 1, rollNumber: 1 }, { unique: true, name: "uk_enrollments_institution_roll" });
schema.index({ studentProfileId: 1 }, { unique: true, name: "uk_enrollments_student_profile" });
schema.index({ institutionId: 1, status: 1 }, { name: "idx_enrollments_institution_status" });
schema.index({ departmentId: 1 }, { name: "idx_enrollments_department" });
schema.index({ programId: 1 }, { name: "idx_enrollments_program" });
schema.index({ batchId: 1 }, { name: "idx_enrollments_batch" });
schema.index({ sectionId: 1 }, { name: "idx_enrollments_section" });

export const StudentEnrollment =
  (mongoose.models.StudentEnrollment as mongoose.Model<StudentEnrollmentDoc>) ??
  mongoose.model<StudentEnrollmentDoc>("StudentEnrollment", schema);

import mongoose, { Schema } from "mongoose";

export interface StudentProfileDoc {
  _id: number;
  userId: number;
  studentId: string;
  fullName: string;
  mobile?: string | null;
  dateOfBirth?: string | null;
  college?: string | null;
  degree?: string | null;
  branch?: string | null;
  graduationYear?: number | null;
  semester?: number | null;
  location?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  profilePhotoUrl?: string | null;
  targetCareerId?: number | null;
  targetCareerName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const studentProfileSchema = new Schema<StudentProfileDoc>(
  {
    _id: { type: Number, required: true },
    userId: { type: Number, required: true, unique: true },
    studentId: { type: String, required: true, unique: true, maxlength: 40 },
    fullName: { type: String, required: true, maxlength: 120 },
    mobile: { type: String, default: null, maxlength: 20 },
    dateOfBirth: { type: String, default: null },
    college: { type: String, default: null, maxlength: 150 },
    degree: { type: String, default: null, maxlength: 100 },
    branch: { type: String, default: null, maxlength: 100 },
    graduationYear: { type: Number, default: null },
    semester: { type: Number, default: null },
    location: { type: String, default: null, maxlength: 150 },
    githubUrl: { type: String, default: null, maxlength: 250 },
    linkedinUrl: { type: String, default: null, maxlength: 250 },
    portfolioUrl: { type: String, default: null, maxlength: 250 },
    profilePhotoUrl: { type: String, default: null, maxlength: 300 },
    targetCareerId: { type: Number, default: null },
    targetCareerName: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

export const StudentProfile =
  (mongoose.models.StudentProfile as mongoose.Model<StudentProfileDoc>) ??
  mongoose.model<StudentProfileDoc>("StudentProfile", studentProfileSchema);

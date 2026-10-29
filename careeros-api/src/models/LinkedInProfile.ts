import mongoose, { Schema } from "mongoose";

export interface LinkedInProfileDoc {
  _id: number;
  userId: number;
  profileUrl: string;
  headline?: string | null;
  about?: string | null;
  currentRole?: string | null;
  experienceText?: string | null;
  skillsText?: string | null;
  educationText?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<LinkedInProfileDoc>({
  _id: { type: Number, required: true },
  userId: { type: Number, required: true },
  profileUrl: { type: String, required: true, maxlength: 500 },
  headline: { type: String, default: null, maxlength: 220 },
  about: { type: String, default: null, maxlength: 3000 },
  currentRole: { type: String, default: null, maxlength: 180 },
  experienceText: { type: String, default: null, maxlength: 5000 },
  skillsText: { type: String, default: null, maxlength: 2000 },
  educationText: { type: String, default: null, maxlength: 2000 },
}, { timestamps: true, versionKey: false, id: false });
schema.index({ userId: 1 }, { unique: true, name: "uk_linkedin_profiles_user" });

export const LinkedInProfile = (mongoose.models.LinkedInProfile as mongoose.Model<LinkedInProfileDoc>) ?? mongoose.model<LinkedInProfileDoc>("LinkedInProfile", schema);

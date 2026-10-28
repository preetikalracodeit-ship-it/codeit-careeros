import mongoose, { Schema } from "mongoose";

export const CAREER_CATEGORIES = [
  "SOFTWARE_DEVELOPMENT",
  "DATA_AI",
  "CLOUD_DEVOPS",
  "CYBERSECURITY",
  "QUALITY_ASSURANCE",
  "BUSINESS",
  "OTHER",
] as const;
export const DIFFICULTY_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export interface CareerDoc {
  _id: number;
  name: string;
  description?: string | null;
  category: (typeof CAREER_CATEGORIES)[number];
  difficultyLevel: (typeof DIFFICULTY_LEVELS)[number];
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const careerSchema = new Schema<CareerDoc>(
  {
    _id: { type: Number, required: true },
    name: { type: String, required: true, unique: true, maxlength: 140 },
    description: { type: String, default: null, maxlength: 1000 },
    category: { type: String, enum: CAREER_CATEGORIES, required: true },
    difficultyLevel: { type: String, enum: DIFFICULTY_LEVELS, required: true },
    published: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, versionKey: false, id: false, collection: "careers" },
);
careerSchema.index({ published: 1, name: 1 }, { name: "idx_careers_published_name" });
careerSchema.index({ category: 1, published: 1 }, { name: "idx_careers_category_published" });

export const Career =
  (mongoose.models.Career as mongoose.Model<CareerDoc>) ??
  mongoose.model<CareerDoc>("Career", careerSchema);

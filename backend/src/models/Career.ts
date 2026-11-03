import mongoose, { Schema } from "mongoose";

export interface CareerDoc {
  _id: number;
  name: string;
  description?: string | null;
  category: string;
  difficultyLevel: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const careerSchema = new Schema<CareerDoc>(
  {
    _id: { type: Number, required: true },
    name: { type: String, required: true, maxlength: 140, unique: true },
    description: { type: String, default: null, maxlength: 1000 },
    category: { type: String, required: true, maxlength: 40 },
    difficultyLevel: { type: String, required: true, maxlength: 20 },
    published: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, versionKey: false, id: false },
);
careerSchema.index({ published: 1, name: 1 }, { name: "idx_careers_published_name" });
careerSchema.index({ category: 1 }, { name: "idx_careers_category" });

export const Career =
  (mongoose.models.Career as mongoose.Model<CareerDoc>) ??
  mongoose.model<CareerDoc>("Career", careerSchema);

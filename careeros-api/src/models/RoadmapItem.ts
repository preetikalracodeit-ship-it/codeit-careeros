import mongoose, { Schema } from "mongoose";

export interface RoadmapStudyContent {
  topics: string[];
  practice: string;
  evidence: string;
  lessons: Array<{ title: string; content: string }>;
  resources: Array<{ title: string; url: string }>;
}

export interface RoadmapItemDoc {
  _id: number;
  phaseId: number;
  skillId?: number | null;
  title: string;
  description?: string | null;
  learningGoal?: string | null;
  studyContent?: RoadmapStudyContent | null;
  displayOrder: number;
  estimatedHours: number;
  createdAt: Date;
}

const studyContentSchema = new Schema<RoadmapStudyContent>({
  topics: { type: [String], required: true },
  practice: { type: String, required: true, maxlength: 1000 },
  evidence: { type: String, required: true, maxlength: 1000 },
  lessons: {
    type: [{ title: { type: String, required: true }, content: { type: String, required: true, maxlength: 1000 } }],
    default: [],
  },
  resources: {
    type: [{ title: { type: String, required: true }, url: { type: String, required: true, maxlength: 500 } }],
    default: [],
  },
}, { _id: false, id: false });

const schema = new Schema<RoadmapItemDoc>({
  _id: { type: Number, required: true },
  phaseId: { type: Number, required: true },
  skillId: { type: Number, default: null },
  title: { type: String, required: true, maxlength: 180 },
  description: { type: String, default: null, maxlength: 1000 },
  learningGoal: { type: String, default: null, maxlength: 500 },
  studyContent: { type: studyContentSchema, default: undefined },
  displayOrder: { type: Number, required: true, min: 0 },
  estimatedHours: { type: Number, required: true, min: 0 },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, id: false });
schema.index({ phaseId: 1, displayOrder: 1 }, { name: "idx_roadmap_items_phase_order" });

export const RoadmapItem =
  (mongoose.models.RoadmapItem as mongoose.Model<RoadmapItemDoc>) ??
  mongoose.model<RoadmapItemDoc>("RoadmapItem", schema);

import mongoose, { Schema } from "mongoose";
export interface ProjectSkillDoc { _id: number; projectId: number; skillId: number; }
const schema = new Schema<ProjectSkillDoc>({ _id: { type: Number, required: true }, projectId: { type: Number, required: true }, skillId: { type: Number, required: true } }, { versionKey: false, id: false, collection: "project_skills" });
schema.index({ projectId: 1, skillId: 1 }, { unique: true, name: "uk_project_skills_project_skill" }); schema.index({ skillId: 1 }, { name: "idx_project_skills_skill" });
export const ProjectSkill = (mongoose.models.ProjectSkill as mongoose.Model<ProjectSkillDoc>) ?? mongoose.model<ProjectSkillDoc>("ProjectSkill", schema);

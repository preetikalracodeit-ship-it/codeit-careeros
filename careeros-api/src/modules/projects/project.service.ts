import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import { AssessmentAttempt } from "../../models/AssessmentAttempt.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { CareerSkill } from "../../models/CareerSkill.js";
import { Project } from "../../models/Project.js";
import { ProjectProgress } from "../../models/ProjectProgress.js";
import { ProjectSkill } from "../../models/ProjectSkill.js";
import { Skill } from "../../models/Skill.js";
import { SkillScore } from "../../models/SkillScore.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import type { ProgressStatus } from "../../models/RoadmapItemProgress.js";

const validStatuses = new Set<ProgressStatus>(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
async function context(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile?.targetCareerId) return null;
  const careerId = profile.targetCareerId;
  const [mappings, assessments] = await Promise.all([CareerSkill.find({ careerId }).lean(), AssessmentTest.find({ careerId }).select("_id").lean()]);
  const attempts = assessments.length ? await AssessmentAttempt.find({ userId, assessmentId: { $in: assessments.map((item) => item._id) }, status: "SUBMITTED" }).sort({ startedAt: -1 }).lean() : [];
  const scoreDocs = attempts.length ? await SkillScore.find({ attemptId: { $in: attempts.map((attempt) => attempt._id) } }).lean() : [];
  const latest = new Map<number, (typeof scoreDocs)[number]>();
  for (const attempt of attempts) for (const score of scoreDocs) if (score.attemptId === attempt._id && !latest.has(score.skillId)) latest.set(score.skillId, score);
  return { careerId, careerName: profile.targetCareerName ?? null, mappings: new Map(mappings.map((mapping) => [mapping.skillId, mapping])), latest };
}

async function enrich(project: { _id: number; title: string; description?: string | null; difficulty: string; estimatedWeeks: number; displayOrder: number }, ctx: NonNullable<Awaited<ReturnType<typeof context>>>, status: ProgressStatus) {
  const relations = await ProjectSkill.find({ projectId: project._id }).sort({ _id: 1 }).lean();
  const skills = relations.length ? await Skill.find({ _id: { $in: relations.map((row) => row.skillId) } }).lean() : [];
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  const projectSkills = relations.flatMap(({ skillId }) => {
    const skill = skillById.get(skillId); if (!skill) return [];
    const mapping = ctx.mappings.get(skillId); const score = ctx.latest.get(skillId);
    return [{ skillId, skillName: skill.name, skillCategory: skill.category, targetPercent: mapping?.targetPercent ?? null, scorePercent: score?.scorePercent ?? null, gapPercent: score && mapping ? score.scorePercent - mapping.targetPercent : null, assessed: Boolean(score) }];
  });
  return { projectId: project._id, title: project.title, description: project.description ?? null, difficulty: project.difficulty, estimatedWeeks: project.estimatedWeeks, displayOrder: project.displayOrder, status, skills: projectSkills };
}

export async function getRecommendedProjects(userId: number) {
  const ctx = await context(userId);
  if (!ctx) return { careerId: null, careerName: null, hasTarget: false, totalProjects: 0, completedProjects: 0, inProgressProjects: 0, projects: [] };
  const projects = await Project.find({ careerId: ctx.careerId, published: true }).sort({ displayOrder: 1, _id: 1 }).lean();
  const progress = projects.length ? await ProjectProgress.find({ userId, projectId: { $in: projects.map((project) => project._id) } }).lean() : [];
  const statusById = new Map(progress.map((item) => [item.projectId, item.status]));
  const rows = await Promise.all(projects.map((project) => enrich(project, ctx, statusById.get(project._id) ?? "NOT_STARTED")));
  return { careerId: ctx.careerId, careerName: ctx.careerName, hasTarget: true, totalProjects: rows.length, completedProjects: rows.filter((row) => row.status === "COMPLETED").length, inProgressProjects: rows.filter((row) => row.status === "IN_PROGRESS").length, projects: rows };
}

export async function updateProjectStatus(userId: number, projectId: number, statusRaw: unknown) {
  const status = typeof statusRaw === "string" ? statusRaw.trim().toUpperCase() as ProgressStatus : "" as ProgressStatus;
  if (!validStatuses.has(status)) throw AppError.badRequest("Status must be NOT_STARTED, IN_PROGRESS or COMPLETED");
  const [ctx, project] = await Promise.all([context(userId), Project.findOne({ _id: projectId, published: true }).lean()]);
  if (!project) throw AppError.notFound(`Project not found: ${projectId}`);
  if (!ctx || project.careerId !== ctx.careerId) throw AppError.forbidden("Project is outside your target career");
  const existing = await ProjectProgress.findOne({ userId, projectId }).lean();
  if (existing) await ProjectProgress.updateOne({ _id: existing._id }, { $set: { status } });
  else {
    try { await ProjectProgress.create({ _id: await getNextSequence("project_progress"), userId, projectId, status }); }
    catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000)) throw error;
      await ProjectProgress.updateOne({ userId, projectId }, { $set: { status } });
    }
  }
  return enrich(project, ctx, status);
}

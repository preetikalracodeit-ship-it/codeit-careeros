import { withTransaction } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import { AssessmentAttempt } from "../../models/AssessmentAttempt.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { CareerSkill } from "../../models/CareerSkill.js";
import { Project } from "../../models/Project.js";
import { ProjectProgress } from "../../models/ProjectProgress.js";
import { ProjectSkill } from "../../models/ProjectSkill.js";
import type { RoadmapStatus } from "../../models/RoadmapItemProgress.js";
import { Skill } from "../../models/Skill.js";
import { SkillScore } from "../../models/SkillScore.js";
import { StudentProfile } from "../../models/StudentProfile.js";

async function latestScores(userId: number, careerId: number, skillIds: number[]) {
  if (!skillIds.length) return new Map<number, number>();
  const attempts = await AssessmentAttempt.find({ userId, status: "SUBMITTED" }).sort({ startedAt: -1 }).lean();
  const tests = await AssessmentTest.find({ _id: { $in: [...new Set(attempts.map((attempt) => attempt.assessmentId))] } }).lean();
  const careerTests = new Set(tests.filter((test) => test.careerId === careerId).map((test) => test._id));
  const relevant = attempts.filter((attempt) => careerTests.has(attempt.assessmentId));
  const scores = relevant.length ? await SkillScore.find({ attemptId: { $in: relevant.map((item) => item._id) }, skillId: { $in: skillIds } }).lean() : [];
  const latest = new Map<number, number>();
  for (const attempt of relevant) for (const score of scores) {
    if (score.attemptId === attempt._id && !latest.has(score.skillId)) latest.set(score.skillId, score.scorePercent);
  }
  return latest;
}

async function skillResponses(userId: number, careerId: number, projects: { _id: number }[]) {
  const mappings = await Promise.all(projects.map((project) => ProjectSkill.find({ projectId: project._id }).lean()));
  const byProject = new Map(projects.map((project, index) => [project._id, mappings[index]]));
  const allSkillIds = [...new Set(mappings.flatMap((rows) => rows.map((row) => row.skillId)))];
  const [skills, framework, scores] = await Promise.all([
    Skill.find({ _id: { $in: allSkillIds } }).lean(),
    CareerSkill.find({ careerId, skillId: { $in: allSkillIds } }).lean(),
    latestScores(userId, careerId, allSkillIds),
  ]);
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  const targetById = new Map(framework.map((mapping) => [mapping.skillId, mapping.targetPercent]));
  return new Map(projects.map((project) => [project._id, (byProject.get(project._id) ?? []).flatMap((row) => {
    const skill = skillById.get(row.skillId);
    if (!skill) return [];
    const score = scores.get(skill._id);
    const target = targetById.get(skill._id);
    return [{
      skillId: skill._id, skillName: skill.name, skillCategory: skill.category,
      ...(target === undefined ? {} : { targetPercent: target }),
      ...(score === undefined ? {} : { scorePercent: score, ...(target === undefined ? {} : { gapPercent: score - target }) }),
      assessed: score !== undefined,
    }];
  })]));
}

function projectResponse(project: { _id: number; title: string; description?: string | null; difficulty: string; estimatedWeeks: number; displayOrder: number }, skills: { skillId: number; skillName: string; skillCategory: string; targetPercent?: number; scorePercent?: number; gapPercent?: number; assessed: boolean }[], status: RoadmapStatus) {
  return { projectId: project._id, title: project.title, ...(project.description == null ? {} : { description: project.description }), difficulty: project.difficulty, estimatedWeeks: project.estimatedWeeks, displayOrder: project.displayOrder, status, skills };
}

export async function getRecommendedProjects(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile?.targetCareerId) return { careerId: null, careerName: null, hasTarget: false, totalProjects: 0, completedProjects: 0, inProgressProjects: 0, projects: [] };
  const careerId = profile.targetCareerId;
  const projects = await Project.find({ careerId, published: true }).sort({ displayOrder: 1 }).lean();
  const [progress, skillsByProject] = await Promise.all([
    projects.length ? ProjectProgress.find({ userId, projectId: { $in: projects.map((project) => project._id) } }).lean() : [],
    skillResponses(userId, careerId, projects),
  ]);
  const statusByProject = new Map(progress.map((row) => [row.projectId, row.status]));
  const responses = projects.map((project) => projectResponse(project, skillsByProject.get(project._id) ?? [], statusByProject.get(project._id) ?? "NOT_STARTED"));
  return {
    careerId, careerName: profile.targetCareerName ?? null, hasTarget: true, totalProjects: responses.length,
    completedProjects: responses.filter((project) => project.status === "COMPLETED").length,
    inProgressProjects: responses.filter((project) => project.status === "IN_PROGRESS").length,
    projects: responses,
  };
}

export async function updateProjectStatus(userId: number, projectId: number, status: RoadmapStatus) {
  const project = await Project.findById(projectId).lean();
  if (!project) throw AppError.notFound(`Project not found: ${projectId}`);
  await withTransaction(async (session) => {
    const existing = await ProjectProgress.findOne({ userId, projectId }).session(session);
    if (existing) {
      existing.status = status;
      await existing.save({ session });
    } else {
      await ProjectProgress.create([{ _id: await getNextSequence("project_progress", session), userId, projectId, status }], { session });
    }
  });
  const [skills] = await Promise.all([skillResponses(userId, project.careerId, [project])]);
  return projectResponse(project, skills.get(project._id) ?? [], status);
}

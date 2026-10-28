import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import { AssessmentAttempt } from "../../models/AssessmentAttempt.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { CareerSkill } from "../../models/CareerSkill.js";
import { RoadmapItem } from "../../models/RoadmapItem.js";
import { RoadmapItemProgress, type ProgressStatus } from "../../models/RoadmapItemProgress.js";
import { RoadmapPhase } from "../../models/RoadmapPhase.js";
import { Skill } from "../../models/Skill.js";
import { SkillScore } from "../../models/SkillScore.js";
import { StudentProfile } from "../../models/StudentProfile.js";

const validStatuses = new Set<ProgressStatus>(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);

async function context(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile?.targetCareerId) return null;
  const careerId = profile.targetCareerId;
  const [mappings, assessments] = await Promise.all([
    CareerSkill.find({ careerId }).sort({ weightPercent: -1 }).lean(),
    AssessmentTest.find({ careerId }).select("_id").lean(),
  ]);
  const submitted = assessments.length ? await AssessmentAttempt.find({ userId, assessmentId: { $in: assessments.map((a) => a._id) }, status: "SUBMITTED" }).sort({ startedAt: -1 }).lean() : [];
  const scoreDocs = submitted.length ? await SkillScore.find({ attemptId: { $in: submitted.map((a) => a._id) } }).lean() : [];
  const latestScores = new Map<number, (typeof scoreDocs)[number]>();
  for (const attempt of submitted) for (const score of scoreDocs) if (score.attemptId === attempt._id && !latestScores.has(score.skillId)) latestScores.set(score.skillId, score);
  return { profile, careerId, careerName: profile.targetCareerName ?? null, mappings: new Map(mappings.map((m) => [m.skillId, m])), latestScores };
}

async function enrichedItem(item: { _id: number; title: string; description?: string | null; learningGoal?: string | null; estimatedHours: number; displayOrder: number; skillId?: number | null }, ctx: NonNullable<Awaited<ReturnType<typeof context>>>, status: ProgressStatus) {
  const skill = item.skillId ? await Skill.findById(item.skillId).lean() : null;
  const mapping = item.skillId ? ctx.mappings.get(item.skillId) : undefined;
  const score = item.skillId ? ctx.latestScores.get(item.skillId) : undefined;
  return {
    itemId: item._id, title: item.title, description: item.description ?? null,
    learningGoal: item.learningGoal ?? null, estimatedHours: item.estimatedHours,
    displayOrder: item.displayOrder, skillId: skill?._id ?? null, skillName: skill?.name ?? null,
    skillCategory: skill?.category ?? null, targetPercent: mapping?.targetPercent ?? null,
    scorePercent: score?.scorePercent ?? null,
    gapPercent: score && mapping ? score.scorePercent - mapping.targetPercent : null,
    assessed: Boolean(score), status,
  };
}

export async function getMyRoadmap(userId: number) {
  const ctx = await context(userId);
  if (!ctx) return { careerId: null, careerName: null, hasTarget: false, progressPercent: 0, totalItems: 0, completedItems: 0, inProgressItems: 0, phases: [] };
  const phases = await RoadmapPhase.find({ careerId: ctx.careerId }).sort({ displayOrder: 1, _id: 1 }).lean();
  const phaseIds = phases.map((phase) => phase._id);
  const items = phaseIds.length ? await RoadmapItem.find({ phaseId: { $in: phaseIds } }).sort({ displayOrder: 1, _id: 1 }).lean() : [];
  const progress = items.length ? await RoadmapItemProgress.find({ userId, roadmapItemId: { $in: items.map((item) => item._id) } }).lean() : [];
  const statusById = new Map(progress.map((p) => [p.roadmapItemId, p.status]));
  const itemsByPhase = new Map<number, typeof items>();
  for (const item of items) { const list = itemsByPhase.get(item.phaseId) ?? []; list.push(item); itemsByPhase.set(item.phaseId, list); }
  let completed = 0; let inProgress = 0;
  const phaseResponses = await Promise.all(phases.map(async (phase) => {
    const phaseItems = itemsByPhase.get(phase._id) ?? [];
    const mapped = await Promise.all(phaseItems.map((item) => {
      const status = statusById.get(item._id) ?? "NOT_STARTED";
      if (status === "COMPLETED") completed += 1; else if (status === "IN_PROGRESS") inProgress += 1;
      return enrichedItem(item, ctx, status);
    }));
    return { phaseId: phase._id, title: phase.title, description: phase.description ?? null, displayOrder: phase.displayOrder, durationDays: phase.durationDays, totalItems: mapped.length, completedItems: mapped.filter((item) => item.status === "COMPLETED").length, items: mapped };
  }));
  return { careerId: ctx.careerId, careerName: ctx.careerName, hasTarget: true, progressPercent: items.length ? Math.round(completed * 100 / items.length) : 0, totalItems: items.length, completedItems: completed, inProgressItems: inProgress, phases: phaseResponses };
}

export async function updateRoadmapItem(userId: number, itemId: number, statusRaw: unknown) {
  const status = typeof statusRaw === "string" ? statusRaw.trim().toUpperCase() as ProgressStatus : "" as ProgressStatus;
  if (!validStatuses.has(status)) throw AppError.badRequest("Status must be NOT_STARTED, IN_PROGRESS or COMPLETED");
  const [ctx, item] = await Promise.all([context(userId), RoadmapItem.findById(itemId).lean()]);
  if (!item) throw AppError.notFound(`Roadmap item not found: ${itemId}`);
  const phase = await RoadmapPhase.findById(item.phaseId).lean();
  if (!phase || !ctx || phase.careerId !== ctx.careerId) throw AppError.forbidden("Roadmap item is outside your target career");
  const existing = await RoadmapItemProgress.findOne({ userId, roadmapItemId: itemId }).lean();
  if (existing) await RoadmapItemProgress.updateOne({ _id: existing._id }, { $set: { status } });
  else {
    try { await RoadmapItemProgress.create({ _id: await getNextSequence("roadmap_item_progress"), userId, roadmapItemId: itemId, status }); }
    catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000)) throw error;
      await RoadmapItemProgress.updateOne({ userId, roadmapItemId: itemId }, { $set: { status } });
    }
  }
  return enrichedItem(item, ctx, status);
}

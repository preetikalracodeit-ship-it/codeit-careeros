import { withTransaction } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import { AssessmentAttempt } from "../../models/AssessmentAttempt.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { CareerSkill } from "../../models/CareerSkill.js";
import { RoadmapItem } from "../../models/RoadmapItem.js";
import { RoadmapItemProgress, type RoadmapStatus } from "../../models/RoadmapItemProgress.js";
import { RoadmapPhase } from "../../models/RoadmapPhase.js";
import { Skill } from "../../models/Skill.js";
import { SkillScore } from "../../models/SkillScore.js";
import { StudentProfile } from "../../models/StudentProfile.js";

type SkillDetail = {
  skillId?: number | null;
  skillName?: string;
  skillCategory?: string;
  targetPercent?: number;
  scorePercent?: number;
  gapPercent?: number;
  assessed: boolean;
};

async function skillDetails(careerId: number, userId: number, skillIds: number[]): Promise<Map<number, SkillDetail>> {
  if (skillIds.length === 0) return new Map();
  const [framework, attempts] = await Promise.all([
    CareerSkill.find({ careerId, skillId: { $in: skillIds } }).lean(),
    AssessmentAttempt.find({ userId, status: "SUBMITTED" }).sort({ startedAt: -1 }).lean(),
  ]);
  const tests = await AssessmentTest.find({ _id: { $in: [...new Set(attempts.map((attempt) => attempt.assessmentId))] } }).lean();
  const careerTestIds = new Set(tests.filter((test) => test.careerId === careerId).map((test) => test._id));
  const relevantAttempts = attempts.filter((attempt) => careerTestIds.has(attempt.assessmentId));
  const scores = relevantAttempts.length
    ? await SkillScore.find({ attemptId: { $in: relevantAttempts.map((attempt) => attempt._id) }, skillId: { $in: skillIds } }).lean()
    : [];
  const latestScore = new Map<number, number>();
  for (const attempt of relevantAttempts) {
    for (const score of scores) {
      if (score.attemptId === attempt._id && !latestScore.has(score.skillId)) latestScore.set(score.skillId, score.scorePercent);
    }
  }
  const skills = await Skill.find({ _id: { $in: skillIds } }).lean();
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  const mappingBySkill = new Map(framework.map((mapping) => [mapping.skillId, mapping]));
  return new Map(skillIds.flatMap((id) => {
    const skill = skillById.get(id);
    if (!skill) return [];
    const mapping = mappingBySkill.get(id);
    const score = latestScore.get(id);
    return [[id, {
      skillId: id,
      skillName: skill.name,
      skillCategory: skill.category,
      ...(mapping ? { targetPercent: mapping.targetPercent } : {}),
      ...(score === undefined ? {} : { scorePercent: score, ...(mapping ? { gapPercent: score - mapping.targetPercent } : {}) }),
      assessed: score !== undefined,
    } as SkillDetail]];
  }));
}

function itemResponse(item: { _id: number; title: string; description?: string | null; learningGoal?: string | null; estimatedHours: number; displayOrder: number; skillId?: number | null }, detail: SkillDetail | undefined, status: RoadmapStatus) {
  return {
    itemId: item._id,
    title: item.title,
    ...(item.description == null ? {} : { description: item.description }),
    ...(item.learningGoal == null ? {} : { learningGoal: item.learningGoal }),
    estimatedHours: item.estimatedHours,
    displayOrder: item.displayOrder,
    ...(item.skillId == null ? {} : { skillId: item.skillId, ...(detail ?? { assessed: false }) }),
    status,
  };
}

function emptyRoadmap() {
  return { careerId: null, careerName: null, hasTarget: false, progressPercent: 0, totalItems: 0, completedItems: 0, inProgressItems: 0, phases: [] };
}

export async function getMyRoadmap(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile?.targetCareerId) return emptyRoadmap();
  const careerId = profile.targetCareerId;
  const phases = await RoadmapPhase.find({ careerId }).sort({ displayOrder: 1 }).lean();
  const items = phases.length
    ? await RoadmapItem.find({ phaseId: { $in: phases.map((phase) => phase._id) } }).sort({ displayOrder: 1 }).lean()
    : [];
  const [progress, details] = await Promise.all([
    items.length ? RoadmapItemProgress.find({ userId, itemId: { $in: items.map((item) => item._id) } }).lean() : [],
    skillDetails(careerId, userId, [...new Set(items.flatMap((item) => item.skillId == null ? [] : [item.skillId]))]),
  ]);
  const statusByItem = new Map(progress.map((row) => [row.itemId, row.status]));
  const itemsByPhase = new Map<number, typeof items>();
  for (const item of items) itemsByPhase.set(item.phaseId, [...(itemsByPhase.get(item.phaseId) ?? []), item]);
  const phasesResponse = phases.map((phase) => {
    const phaseItems = itemsByPhase.get(phase._id) ?? [];
    const phaseResponses = phaseItems.map((item) => itemResponse(item, item.skillId == null ? undefined : details.get(item.skillId), statusByItem.get(item._id) ?? "NOT_STARTED"));
    return {
      phaseId: phase._id, title: phase.title,
      ...(phase.description == null ? {} : { description: phase.description }),
      displayOrder: phase.displayOrder, durationDays: phase.durationDays,
      totalItems: phaseResponses.length,
      completedItems: phaseResponses.filter((item) => item.status === "COMPLETED").length,
      items: phaseResponses,
    };
  });
  const totalItems = items.length;
  const completedItems = progress.filter((row) => row.status === "COMPLETED" && items.some((item) => item._id === row.itemId)).length;
  const inProgressItems = progress.filter((row) => row.status === "IN_PROGRESS" && items.some((item) => item._id === row.itemId)).length;
  return {
    careerId, careerName: profile.targetCareerName ?? null, hasTarget: true,
    progressPercent: totalItems === 0 ? 0 : Math.round((completedItems * 100) / totalItems),
    totalItems, completedItems, inProgressItems, phases: phasesResponse,
  };
}

export async function updateRoadmapItemStatus(userId: number, itemId: number, status: RoadmapStatus) {
  const item = await RoadmapItem.findById(itemId).lean();
  if (!item) throw AppError.notFound(`Roadmap item not found: ${itemId}`);
  const phase = await RoadmapPhase.findById(item.phaseId).lean();
  if (!phase) throw AppError.notFound(`Roadmap phase not found for item: ${itemId}`);
  await withTransaction(async (session) => {
    const existing = await RoadmapItemProgress.findOne({ userId, itemId }).session(session);
    if (existing) {
      existing.status = status;
      await existing.save({ session });
    } else {
      await RoadmapItemProgress.create([{
        _id: await getNextSequence("roadmap_item_progress", session), userId, itemId, status,
      }], { session });
    }
  });
  const detailMap = item.skillId == null ? new Map<number, SkillDetail>() : await skillDetails(phase.careerId, userId, [item.skillId]);
  return itemResponse(item, item.skillId == null ? undefined : detailMap.get(item.skillId), status);
}

import { AssessmentAttempt } from "../../models/AssessmentAttempt.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { Career } from "../../models/Career.js";
import { CareerSkill } from "../../models/CareerSkill.js";
import { Skill } from "../../models/Skill.js";
import { SkillScore } from "../../models/SkillScore.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { getAttemptHistory } from "./attempt-history.service.js";

type Gap = {
  skillId: number;
  skillName: string;
  skillCategory: string;
  weightPercent: number;
  requiredLevel: string;
  targetPercent: number;
  scorePercent?: number;
  correctCount?: number;
  questionCount?: number;
  gapPercent?: number;
  metTarget: boolean;
  assessed: boolean;
  level?: string;
  sourceAttemptId?: number;
};

function resultLevel(score: number): string {
  if (score >= 80) return "STRONG";
  if (score >= 65) return "GOOD";
  if (score >= 50) return "DEVELOPING";
  if (score >= 35) return "NEEDS_IMPROVEMENT";
  return "PRIORITY_GAP";
}

function readinessPercent(gaps: Gap[]): number | null {
  let weightedTarget = 0;
  let weightedScore = 0;
  for (const gap of gaps) {
    if (!gap.assessed || gap.scorePercent === undefined) continue;
    if (gap.targetPercent > 0) {
      weightedTarget += gap.weightPercent * gap.targetPercent;
      weightedScore += gap.weightPercent * Math.min(gap.scorePercent, gap.targetPercent);
    }
  }
  if (weightedTarget > 0) return Math.round((weightedScore * 100) / weightedTarget);
  const assessed = gaps.filter((gap) => gap.assessed && gap.scorePercent !== undefined);
  return assessed.length
    ? Math.round(assessed.reduce((total, gap) => total + gap.scorePercent!, 0) / assessed.length)
    : null;
}

export async function getStudentReadiness(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile?.targetCareerId) {
    return {
      targetCareerId: null,
      targetCareerName: null,
      hasTarget: false,
      readinessPercent: null,
      readinessLevel: "NOT_ASSESSED",
      totalSkills: 0,
      assessedSkills: 0,
      metSkills: 0,
      submittedAttempts: 0,
      strengths: [],
      improvements: [],
      gaps: [],
    };
  }

  const career = await Career.findById(profile.targetCareerId).lean();
  if (!career) {
    return {
      targetCareerId: profile.targetCareerId,
      targetCareerName: profile.targetCareerName,
      hasTarget: true,
      readinessPercent: null,
      readinessLevel: "NOT_ASSESSED",
      totalSkills: 0,
      assessedSkills: 0,
      metSkills: 0,
      submittedAttempts: 0,
      strengths: [],
      improvements: [],
      gaps: [],
    };
  }

  const framework = await CareerSkill.find({ careerId: career._id })
    .sort({ weightPercent: -1 })
    .lean();
  const attempts = await AssessmentAttempt.find({ userId, status: "SUBMITTED" })
    .sort({ startedAt: -1 })
    .lean();
  const assessments = await AssessmentTest.find({
    _id: { $in: [...new Set(attempts.map((attempt) => attempt.assessmentId))] },
  }).lean();
  const careerAssessmentIds = new Set(
    assessments.filter((item) => item.careerId === career._id).map((item) => item._id),
  );
  const relevantAttempts = attempts.filter((attempt) => careerAssessmentIds.has(attempt.assessmentId));
  const scores = relevantAttempts.length
    ? await SkillScore.find({ attemptId: { $in: relevantAttempts.map((attempt) => attempt._id) } })
        .sort({ weightPercent: -1 })
        .lean()
    : [];
  const latestScore = new Map<number, (typeof scores)[number]>();
  const attemptForSkill = new Map<number, number>();
  for (const attempt of relevantAttempts) {
    for (const score of scores.filter((row) => row.attemptId === attempt._id)) {
      if (!latestScore.has(score.skillId)) {
        latestScore.set(score.skillId, score);
        attemptForSkill.set(score.skillId, attempt._id);
      }
    }
  }

  const skills = await Skill.find({ _id: { $in: framework.map((item) => item.skillId) } }).lean();
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  const gaps: Gap[] = framework.flatMap((mapping): Gap[] => {
    const skill = skillById.get(mapping.skillId);
    if (!skill) return [];
    const score = latestScore.get(mapping.skillId);
    if (!score) {
      return [{
        skillId: skill._id,
        skillName: skill.name,
        skillCategory: skill.category,
        weightPercent: mapping.weightPercent,
        requiredLevel: mapping.requiredLevel,
        targetPercent: mapping.targetPercent,
        metTarget: false,
        assessed: false,
      }];
    }
    return [{
      skillId: skill._id,
      skillName: skill.name,
      skillCategory: skill.category,
      weightPercent: mapping.weightPercent,
      requiredLevel: mapping.requiredLevel,
      targetPercent: mapping.targetPercent,
      scorePercent: score.scorePercent,
      correctCount: score.correctCount,
      questionCount: score.questionCount,
      gapPercent: score.scorePercent - mapping.targetPercent,
      metTarget: score.scorePercent >= mapping.targetPercent,
      assessed: true,
      level: resultLevel(score.scorePercent),
      sourceAttemptId: attemptForSkill.get(skill._id),
    }];
  });

  const assessed = gaps.filter((gap) => gap.assessed);
  const met = assessed.filter((gap) => gap.metTarget);
  const allHistory = await getAttemptHistory(userId);
  const historyForCareer = allHistory.filter((item) => item.careerId === career._id);
  const readiness = readinessPercent(gaps);
  return {
    targetCareerId: career._id,
    targetCareerName: career.name,
    hasTarget: true,
    readinessPercent: readiness,
    readinessLevel: readiness == null ? "NOT_ASSESSED" : resultLevel(readiness),
    totalSkills: gaps.length,
    assessedSkills: assessed.length,
    metSkills: met.length,
    submittedAttempts: relevantAttempts.length,
    ...(historyForCareer[0] ? { latestAttempt: historyForCareer[0] } : {}),
    strengths: [...met].sort((a, b) => b.scorePercent! - a.scorePercent!).slice(0, 3),
    improvements: [...gaps]
      .filter((gap) => gap.assessed && !gap.metTarget)
      .sort((a, b) => (a.gapPercent ?? Number.MIN_SAFE_INTEGER) - (b.gapPercent ?? Number.MIN_SAFE_INTEGER))
      .slice(0, 3),
    gaps,
  };
}

import { AppError } from "../../lib/errors.js";
import { AssessmentAnswer } from "../../models/AssessmentAnswer.js";
import { AssessmentAttempt } from "../../models/AssessmentAttempt.js";
import { AssessmentAttemptQuestion } from "../../models/AssessmentAttemptQuestion.js";
import { AssessmentQuestion } from "../../models/AssessmentQuestion.js";
import type { AssessmentQuestionDoc } from "../../models/AssessmentQuestion.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { Career } from "../../models/Career.js";
import { QuestionOption } from "../../models/QuestionOption.js";
import { Skill } from "../../models/Skill.js";
import { SkillScore } from "../../models/SkillScore.js";
import { CareerSkill } from "../../models/CareerSkill.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { getNextSequence } from "../../models/Counter.js";
import { withTransaction } from "../../lib/db.js";
import { randomBytes } from "node:crypto";
import type { ClientSession } from "mongoose";

function assertNotExpired(attempt: { expiresAt: Date }) {
  if (attempt.expiresAt.getTime() < Date.now()) {
    throw new AppError(410, "ATTEMPT_EXPIRED", "The time limit for this attempt has expired");
  }
}

const MAX_ATTEMPT_QUESTIONS = 20;
const DEFAULT_UNMAPPED_SKILL_WEIGHT = 5;

function resultLevel(score: number): string {
  if (score >= 80) return "STRONG";
  if (score >= 65) return "GOOD";
  if (score >= 50) return "DEVELOPING";
  if (score >= 35) return "NEEDS_IMPROVEMENT";
  return "PRIORITY_GAP";
}

function shuffle<T>(values: T[]): T[] {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  return values;
}

function difficultyRoundRobin<T extends { difficulty: string }>(pool: T[]): T[] {
  const levels = new Map<string, T[]>();
  for (const item of pool) {
    const group = levels.get(item.difficulty) ?? [];
    group.push(item);
    levels.set(item.difficulty, group);
  }
  const orderedLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED", ...[...levels.keys()].filter(
    (level) => !["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(level),
  )];
  for (const group of levels.values()) shuffle(group);
  const ordered: T[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const level of orderedLevels) {
      const next = levels.get(level)?.shift();
      if (next) {
        ordered.push(next);
        added = true;
      }
    }
  }
  return ordered;
}

function quotas(skillIds: number[], weights: Map<number, number>, pools: Map<number, unknown[]>, size: number) {
  const weight = (id: number) => weights.get(id) ?? DEFAULT_UNMAPPED_SKILL_WEIGHT;
  const totalWeight = skillIds.reduce((sum, id) => sum + weight(id), 0);
  const result = new Map<number, number>();
  const remainder = new Map<number, number>();
  let allocated = 0;
  for (const id of skillIds) {
    const exact = totalWeight <= 0 ? 0 : (size * weight(id)) / totalWeight;
    const whole = Math.floor(exact);
    result.set(id, whole);
    remainder.set(id, exact - whole);
    allocated += whole;
  }
  const byRemainder = [...skillIds].sort((a, b) =>
    (remainder.get(b)! - remainder.get(a)!) || (weight(b) - weight(a)));
  for (let i = 0; allocated < size && i < byRemainder.length; i += 1, allocated += 1) {
    result.set(byRemainder[i]!, (result.get(byRemainder[i]!) ?? 0) + 1);
  }
  for (const id of skillIds) {
    if ((result.get(id) ?? 0) > 0 || !(pools.get(id)?.length)) continue;
    const donor = skillIds.find((candidate) => (result.get(candidate) ?? 0) > 1);
    if (!donor) break;
    result.set(donor, result.get(donor)! - 1);
    result.set(id, 1);
  }
  let moved: boolean;
  do {
    moved = false;
    for (const id of skillIds) {
      let spare = (result.get(id) ?? 0) - (pools.get(id)?.length ?? 0);
      while (spare > 0) {
        const receiver = skillIds.find((other) =>
          (result.get(other) ?? 0) < (pools.get(other)?.length ?? 0));
        if (receiver === undefined) break;
        result.set(id, result.get(id)! - 1);
        result.set(receiver, (result.get(receiver) ?? 0) + 1);
        spare -= 1;
        moved = true;
      }
    }
  } while (moved);
  return result;
}

async function selectQuestions(
  assessmentId: number,
  careerId: number,
  userId: number,
  bank: AssessmentQuestionDoc[],
  session: ClientSession,
) {
  if (bank.length <= MAX_ATTEMPT_QUESTIONS) return shuffle([...bank]);
  const framework = await CareerSkill.find({ careerId }).session(session).lean();
  const weights = new Map(framework.map((row) => [row.skillId, row.weightPercent]));
  const bySkill = new Map<number, typeof bank>();
  for (const question of bank) {
    const group = bySkill.get(question.skillId) ?? [];
    group.push(question);
    bySkill.set(question.skillId, group);
  }
  const skillIds = [...bySkill.keys()].sort((a, b) =>
    (weights.get(b) ?? DEFAULT_UNMAPPED_SKILL_WEIGHT) - (weights.get(a) ?? DEFAULT_UNMAPPED_SKILL_WEIGHT));
  const quota = quotas(skillIds, weights, bySkill, MAX_ATTEMPT_QUESTIONS);
  const previousAttempts = await AssessmentAttempt.find({ userId, assessmentId }).select("_id").session(session).lean();
  const priorQuestions = await AssessmentAttemptQuestion.find({ attemptId: { $in: previousAttempts.map((a) => a._id) } })
    .select("questionId").session(session).lean();
  const seenIds = new Set(priorQuestions.map((row) => row.questionId));
  const unseen = new Map<number, typeof bank>();
  const seen = new Map<number, typeof bank>();
  for (const id of skillIds) {
    unseen.set(id, (bySkill.get(id) ?? []).filter((question) => !seenIds.has(question._id)));
    seen.set(id, (bySkill.get(id) ?? []).filter((question) => seenIds.has(question._id)));
  }
  const unseenTotal = [...unseen.values()].reduce((sum, rows) => sum + rows.length, 0);
  const selected: typeof bank = [];
  if (unseenTotal >= MAX_ATTEMPT_QUESTIONS) {
    for (const id of skillIds) {
      const ordered = difficultyRoundRobin([...(unseen.get(id) ?? [])]);
      ordered.push(...difficultyRoundRobin([...(seen.get(id) ?? [])]));
      selected.push(...ordered.slice(0, quota.get(id) ?? 0));
    }
  } else {
    for (const id of skillIds) selected.push(...(unseen.get(id) ?? []));
    const refill = quotas(skillIds, weights, seen, MAX_ATTEMPT_QUESTIONS - selected.length);
    for (const id of skillIds) selected.push(...difficultyRoundRobin([...(seen.get(id) ?? [])]).slice(0, refill.get(id) ?? 0));
  }
  return shuffle(selected);
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0;
  for (let i = items.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

async function attemptDetails(attemptId: number) {
  const attempt = await AssessmentAttempt.findById(attemptId).lean();
  if (!attempt) throw AppError.notFound(`Attempt not found: ${attemptId}`);
  const assessment = await AssessmentTest.findById(attempt.assessmentId).lean();
  const career = assessment ? await Career.findById(assessment.careerId).lean() : null;
  if (!assessment || !career) throw AppError.notFound("Assessment not found");
  return { attempt, assessment, career };
}

async function questionsForAttempt(attemptId: number, assessmentId: number, session?: ClientSession) {
  const frozenQuery = AssessmentAttemptQuestion.find({ attemptId }).sort({ displayOrder: 1 });
  if (session) frozenQuery.session(session);
  const frozen = await frozenQuery.lean();
  if (frozen.length) {
    const questionsQuery = AssessmentQuestion.find({ _id: { $in: frozen.map((row) => row.questionId) } });
    if (session) questionsQuery.session(session);
    const byId = new Map((await questionsQuery.lean())
      .map((question) => [question._id, question]));
    return frozen.flatMap((row) => {
      const question = byId.get(row.questionId);
      return question ? [{ ...question, displayOrder: row.displayOrder }] : [];
    });
  }
  const bankQuery = AssessmentQuestion.find({ assessmentId, active: true }).sort({ displayOrder: 1 });
  if (session) bankQuery.session(session);
  const bank = await bankQuery.lean();
  return seededShuffle(bank, attemptId * 1_000_003 + 17);
}

async function inProgressPayload(attemptId: number, assessmentId: number) {
  const questions = await questionsForAttempt(attemptId, assessmentId);
  const questionIds = questions.map((question) => question._id);
  const [options, answers, skills] = await Promise.all([
    QuestionOption.find({ questionId: { $in: questionIds } }).sort({ displayOrder: 1 }).lean(),
    AssessmentAnswer.find({ attemptId }).lean(),
    Skill.find({ _id: { $in: questions.map((question) => question.skillId) } }).lean(),
  ]);
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  const optionsByQuestion = new Map<number, typeof options>();
  for (const option of options) {
    const group = optionsByQuestion.get(option.questionId) ?? [];
    group.push(option);
    optionsByQuestion.set(option.questionId, group);
  }
  const selectedByQuestion = new Map(answers.map((answer) => [answer.questionId, answer.selectedOptionId]));
  const presented = questions.flatMap((question, index) => {
    const skill = skillById.get(question.skillId);
    if (!skill) return [];
    const questionOptions = seededShuffle(
      [...(optionsByQuestion.get(question._id) ?? [])],
      attemptId * 1_000_003 + question._id * 31 + 17,
    );
    return [{
      questionId: question._id,
      displayOrder: index,
      skillName: skill.name,
      skillCategory: skill.category,
      questionText: question.questionText,
      difficulty: question.difficulty,
      ...(selectedByQuestion.get(question._id) == null ? {} : { selectedOptionId: selectedByQuestion.get(question._id) }),
      options: questionOptions.map((option) => ({
        optionId: option._id,
        optionText: option.optionText,
        displayOrder: option.displayOrder,
      })),
    }];
  });
  return { questions: presented, answeredQuestionIds: answers.map((answer) => answer.questionId) };
}

async function skillResults(attemptId: number) {
  const scores = await SkillScore.find({ attemptId }).sort({ weightPercent: -1 }).lean();
  const skills = await Skill.find({ _id: { $in: scores.map((score) => score.skillId) } }).lean();
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  return scores.flatMap((score) => {
    const skill = skillById.get(score.skillId);
    return skill ? [{
      skillId: skill._id,
      skillName: skill.name,
      skillCategory: skill.category,
      weightPercent: score.weightPercent,
      targetPercent: score.targetPercent,
      questionCount: score.questionCount,
      correctCount: score.correctCount,
      scorePercent: score.scorePercent,
      level: score.level,
    }] : [];
  });
}

export async function getAttemptState(attemptId: number, userId: number) {
  const details = await attemptDetails(attemptId);
  let attempt = details.attempt;
  const { assessment, career } = details;
  if (attempt.userId !== userId) throw AppError.forbidden("You do not have access to this attempt");
  if (attempt.status === "IN_PROGRESS" && attempt.expiresAt.getTime() < Date.now()) {
    await AssessmentAttempt.updateOne({ _id: attemptId, status: "IN_PROGRESS" }, { $set: { status: "EXPIRED" } });
    attempt = { ...attempt, status: "EXPIRED" };
  }

  const base = {
    attemptId: attempt._id,
    attemptCode: attempt.attemptCode,
    assessmentId: assessment._id,
    assessmentTitle: assessment.title,
    careerId: career._id,
    careerName: career.name,
    status: attempt.status,
    durationMinutes: assessment.durationMinutes,
    totalQuestions: attempt.totalQuestions,
    answeredCount: attempt.answeredCount,
    ...(attempt.overallScore == null ? {} : { overallScore: attempt.overallScore }),
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    ...(attempt.submittedAt == null ? {} : { submittedAt: attempt.submittedAt.toISOString() }),
  };
  if (attempt.status === "IN_PROGRESS") {
    return { ...base, ...(await inProgressPayload(attemptId, assessment._id)), skills: undefined };
  }
  if (attempt.status === "SUBMITTED") {
    return { ...base, answeredQuestionIds: [], questions: undefined, skills: await skillResults(attemptId) };
  }
  return { ...base, answeredQuestionIds: [], questions: [] };
}

export async function getMyLatestAttempt(assessmentId: number, userId: number) {
  const attempt = await AssessmentAttempt.findOne({ userId, assessmentId })
    .sort({ startedAt: -1 })
    .lean();
  return attempt ? getAttemptState(attempt._id, userId) : null;
}

export async function startAttempt(assessmentId: number, userId: number) {
  let attemptId = 0;
  await withTransaction(async (session) => {
    const assessment = await AssessmentTest.findOne({ _id: assessmentId, published: true }).session(session).lean();
    if (!assessment) throw AppError.notFound(`Assessment not found or not available: ${assessmentId}`);
    const career = await Career.findById(assessment.careerId).session(session).lean();
    if (!career) throw AppError.notFound(`Career not found: ${assessment.careerId}`);
    const profile = await StudentProfile.findOne({ userId }).session(session).lean();
    if (profile?.targetCareerId && profile.targetCareerId !== assessment.careerId) {
      throw AppError.forbidden(
        `This assessment belongs to '${career.name}' but your target career is '${profile.targetCareerName}'. Select the matching career first.`,
      );
    }

    let existing = await AssessmentAttempt.findOne({ userId, assessmentId, status: "IN_PROGRESS" })
      .session(session);
    if (existing && existing.expiresAt.getTime() < Date.now()) {
      existing.status = "EXPIRED";
      await existing.save({ session });
      existing = null;
    }
    if (existing) {
      attemptId = existing._id;
      return;
    }

    const bank = await AssessmentQuestion.find({ assessmentId, active: true }).sort({ displayOrder: 1 }).session(session).lean();
    if (!bank.length) throw AppError.conflict("This assessment has no questions yet");
    const selected = await selectQuestions(assessmentId, assessment.careerId, userId, bank, session);
    const startedAt = new Date();
    attemptId = await getNextSequence("assessment_attempts", session);
    const attemptCode = randomBytes(12).toString("hex");
    await AssessmentAttempt.create([{
      _id: attemptId,
      attemptCode,
      userId,
      assessmentId,
      status: "IN_PROGRESS",
      startedAt,
      expiresAt: new Date(startedAt.getTime() + assessment.durationMinutes * 60_000),
      totalQuestions: selected.length,
      answeredCount: 0,
    }], { session });
    for (let index = 0; index < selected.length; index += 1) {
      await AssessmentAttemptQuestion.create([{
        _id: await getNextSequence("assessment_attempt_questions", session),
        attemptId,
        questionId: selected[index]!._id,
        displayOrder: index,
      }], { session });
    }
  });

  const state = await getAttemptState(attemptId, userId);
  return {
    attemptId: state.attemptId,
    attemptCode: state.attemptCode,
    assessmentId: state.assessmentId,
    assessmentTitle: state.assessmentTitle,
    careerId: state.careerId,
    careerName: state.careerName,
    durationMinutes: state.durationMinutes,
    totalQuestions: state.totalQuestions,
    startedAt: state.startedAt,
    expiresAt: state.expiresAt,
    answeredQuestionIds: state.answeredQuestionIds,
    questions: state.questions,
  };
}

export async function saveAttemptAnswer(
  attemptId: number,
  userId: number,
  input: { questionId: number; optionId: number },
) {
  let expired = false;
  let response: { attemptId: number; answeredCount: number; totalQuestions: number; answeredQuestionIds: number[] } | undefined;
  await withTransaction(async (session) => {
    const attempt = await AssessmentAttempt.findById(attemptId).session(session);
    if (!attempt) throw AppError.notFound(`Attempt not found: ${attemptId}`);
    if (attempt.userId !== userId) throw AppError.forbidden("You do not have access to this attempt");
    if (attempt.status !== "IN_PROGRESS") throw AppError.badRequest("This attempt has already been submitted");
    if (attempt.expiresAt.getTime() < Date.now()) {
      attempt.status = "EXPIRED";
      await attempt.save({ session });
      expired = true;
      return;
    }
    const question = await AssessmentQuestion.findById(input.questionId).session(session).lean();
    if (!question) throw AppError.badRequest(`Question not found: ${input.questionId}`);
    if (question.assessmentId !== attempt.assessmentId) {
      throw AppError.badRequest("Question does not belong to this assessment");
    }
    const frozenCount = await AssessmentAttemptQuestion.countDocuments({ attemptId }).session(session);
    if (frozenCount > 0 && !(await AssessmentAttemptQuestion.exists({ attemptId, questionId: question._id }).session(session))) {
      throw AppError.badRequest("Question does not belong to this attempt");
    }
    const option = await QuestionOption.findById(input.optionId).session(session).lean();
    if (!option) throw AppError.badRequest(`Option not found: ${input.optionId}`);
    if (option.questionId !== question._id) {
      throw AppError.badRequest("Option does not belong to this question");
    }

    let answer = await AssessmentAnswer.findOne({ attemptId, questionId: question._id }).session(session);
    if (!answer) {
      answer = new AssessmentAnswer({
        _id: await getNextSequence("assessment_answers", session),
        attemptId,
        questionId: question._id,
      });
    }
    answer.selectedOptionId = option._id;
    await answer.save({ session });
    const answers = await AssessmentAnswer.find({ attemptId }).select("questionId").session(session).lean();
    attempt.answeredCount = answers.length;
    await attempt.save({ session });
    response = {
      attemptId,
      answeredCount: answers.length,
      totalQuestions: attempt.totalQuestions,
      answeredQuestionIds: answers.map((item) => item.questionId),
    };
  });
  if (expired) assertNotExpired({ expiresAt: new Date(0) });
  return response;
}

export async function submitAttempt(attemptId: number, userId: number) {
  let expired = false;
  await withTransaction(async (session) => {
    const attempt = await AssessmentAttempt.findById(attemptId).session(session);
    if (!attempt) throw AppError.notFound(`Attempt not found: ${attemptId}`);
    if (attempt.userId !== userId) throw AppError.forbidden("You do not have access to this attempt");
    if (attempt.status !== "IN_PROGRESS") throw AppError.badRequest("This attempt has already been submitted");
    if (attempt.expiresAt.getTime() < Date.now()) {
      attempt.status = "EXPIRED";
      await attempt.save({ session });
      expired = true;
      return;
    }

    const assessment = await AssessmentTest.findById(attempt.assessmentId).session(session).lean();
    const career = assessment ? await Career.findById(assessment.careerId).session(session).lean() : null;
    if (!assessment || !career) throw AppError.notFound("Assessment not found");
    const questions = await questionsForAttempt(attemptId, assessment._id, session);
    const answers = await AssessmentAnswer.find({ attemptId }).session(session).lean();
    const selectedOptionIds = answers.flatMap((answer) =>
      answer.selectedOptionId == null ? [] : [answer.selectedOptionId]);
    const options = await QuestionOption.find({ _id: { $in: selectedOptionIds } })
      .session(session).lean();
    const correctOptionIds = new Set(options.filter((option) => option.correct).map((option) => option._id));
    const scoreRows = await CareerSkill.find({ careerId: career._id }).session(session).lean();
    const mappingBySkill = new Map(scoreRows.map((row) => [row.skillId, row]));
    const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
    const questionsBySkill = new Map<number, typeof questions>();
    for (const question of questions) {
      const group = questionsBySkill.get(question.skillId) ?? [];
      group.push(question);
      questionsBySkill.set(question.skillId, group);
    }
    const rawScores = [] as Array<{
      skillId: number; questionCount: number; correctCount: number; scorePercent: number;
      weightPercent: number; targetPercent: number; level: string;
    }>;
    for (const [skillId, skillQuestions] of questionsBySkill) {
      const correctCount = skillQuestions.filter((question) => {
        const selectedOptionId = answerByQuestion.get(question._id)?.selectedOptionId;
        return selectedOptionId != null && correctOptionIds.has(selectedOptionId);
      }).length;
      const scorePercent = skillQuestions.length ? Math.round((correctCount * 100) / skillQuestions.length) : 0;
      const mapping = mappingBySkill.get(skillId);
      rawScores.push({
        skillId,
        questionCount: skillQuestions.length,
        correctCount,
        scorePercent,
        weightPercent: mapping?.weightPercent ?? 0,
        targetPercent: mapping?.targetPercent ?? 80,
        level: resultLevel(scorePercent),
      });
    }
    const totalWeight = rawScores.reduce((sum, row) => sum + row.weightPercent, 0);
    const overallScore = rawScores.length
      ? Math.round(totalWeight > 0
        ? rawScores.reduce((sum, row) => sum + row.weightPercent * row.scorePercent, 0) / totalWeight
        : rawScores.reduce((sum, row) => sum + row.scorePercent, 0) / rawScores.length)
      : 0;
    for (const score of rawScores) {
      const skillScoreId = await getNextSequence("skill_scores", session);
      await SkillScore.create([{ _id: skillScoreId, attemptId, ...score }], { session });
    }
    attempt.answeredCount = answers.length;
    attempt.overallScore = overallScore;
    attempt.status = "SUBMITTED";
    attempt.submittedAt = new Date();
    await attempt.save({ session });
  });
  if (expired) assertNotExpired({ expiresAt: new Date(0) });
  const state = await getAttemptState(attemptId, userId);
  return {
    attemptId: state.attemptId,
    assessmentId: state.assessmentId,
    assessmentTitle: state.assessmentTitle,
    careerId: state.careerId,
    careerName: state.careerName,
    status: state.status,
    startedAt: state.startedAt,
    submittedAt: state.submittedAt,
    totalQuestions: state.totalQuestions,
    answeredCount: state.answeredCount,
    overallScore: state.overallScore,
    skills: await skillResults(attemptId),
  };
}

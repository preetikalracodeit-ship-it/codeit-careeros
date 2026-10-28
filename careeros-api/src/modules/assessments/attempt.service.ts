import { randomInt, randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import { AppError } from "../../lib/errors.js";
import { withTransaction } from "../../lib/db.js";
import { getNextSequence } from "../../models/Counter.js";
import { AssessmentAnswer } from "../../models/AssessmentAnswer.js";
import { AssessmentAttempt, type AssessmentAttemptDoc } from "../../models/AssessmentAttempt.js";
import { AssessmentAttemptQuestion } from "../../models/AssessmentAttemptQuestion.js";
import { AssessmentQuestion } from "../../models/AssessmentQuestion.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { Career } from "../../models/Career.js";
import { CareerSkill } from "../../models/CareerSkill.js";
import { QuestionOption } from "../../models/QuestionOption.js";
import { Skill } from "../../models/Skill.js";
import { SkillScore, type ResultLevel } from "../../models/SkillScore.js";
import { StudentProfile } from "../../models/StudentProfile.js";

const MAX_ATTEMPT_QUESTIONS = 20;
const DEFAULT_UNMAPPED_WEIGHT = 5;
const DEFAULT_TARGET_PERCENT = 80;

function duplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000;
}

function resultLevel(score: number): ResultLevel {
  if (score >= 80) return "STRONG";
  if (score >= 65) return "GOOD";
  if (score >= 50) return "DEVELOPING";
  if (score >= 35) return "NEEDS_IMPROVEMENT";
  return "PRIORITY_GAP";
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function seededShuffle<T>(values: T[], seed: number): T[] {
  const result = [...values];
  let state = (seed >>> 0) || 0x6d2b79f5;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function orderDifficultyBalanced<T extends { difficulty: string }>(pool: T[]): T[] {
  const order = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
  const buckets = new Map(order.map((difficulty) => [difficulty, shuffle(pool.filter((item) => item.difficulty === difficulty))]));
  const result: T[] = [];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const difficulty of order) {
      const item = buckets.get(difficulty)?.shift();
      if (item) {
        result.push(item);
        remaining = true;
      }
    }
  }
  return result;
}

async function selectQuestions(assessmentId: number, careerId: number, userId: number, bank: Array<{ _id: number; skillId: number; difficulty: string }>, session: ClientSession) {
  if (bank.length <= MAX_ATTEMPT_QUESTIONS) return shuffle(bank);

  const framework = await CareerSkill.find({ careerId }).session(session).lean();
  const weightBySkill = new Map(framework.map((row) => [row.skillId, row.weightPercent]));
  const attempts = await AssessmentAttempt.find({ userId, assessmentId }).select("_id").session(session).lean();
  const previousAttemptIds = attempts.map((attempt) => attempt._id);
  const seenRows = previousAttemptIds.length
    ? await AssessmentAttemptQuestion.find({ attemptId: { $in: previousAttemptIds } }).select("questionId").session(session).lean()
    : [];
  const seen = new Set(seenRows.map((row) => row.questionId));

  const bySkill = new Map<number, typeof bank>();
  for (const question of bank) {
    const group = bySkill.get(question.skillId) || [];
    group.push(question);
    bySkill.set(question.skillId, group);
  }
  const skillIds = [...bySkill.keys()].sort((a, b) =>
    (weightBySkill.get(b) ?? DEFAULT_UNMAPPED_WEIGHT) - (weightBySkill.get(a) ?? DEFAULT_UNMAPPED_WEIGHT) || a - b,
  );
  const weights = new Map(skillIds.map((id) => [id, weightBySkill.get(id) ?? DEFAULT_UNMAPPED_WEIGHT]));
  const totalWeight = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || skillIds.length;
  const quota = new Map<number, number>();
  const remainder = new Map<number, number>();
  let allocated = 0;
  for (const skillId of skillIds) {
    const exact = MAX_ATTEMPT_QUESTIONS * (weights.get(skillId) || 1) / totalWeight;
    const floor = Math.floor(exact);
    quota.set(skillId, floor);
    remainder.set(skillId, exact - floor);
    allocated += floor;
  }
  const remainders = [...skillIds].sort((a, b) =>
    (remainder.get(b) ?? 0) - (remainder.get(a) ?? 0) || (weights.get(b) ?? 0) - (weights.get(a) ?? 0),
  );
  for (let i = 0; allocated < MAX_ATTEMPT_QUESTIONS; i += 1, allocated += 1) {
    const id = remainders[i % remainders.length];
    quota.set(id, (quota.get(id) ?? 0) + 1);
  }

  // Cap weighted allocations to each skill's bank and redistribute overflow to skills with spare questions.
  let overflow = 0;
  for (const skillId of skillIds) {
    const excess = Math.max(0, (quota.get(skillId) ?? 0) - (bySkill.get(skillId)?.length ?? 0));
    quota.set(skillId, (quota.get(skillId) ?? 0) - excess);
    overflow += excess;
  }
  while (overflow > 0) {
    const receiver = skillIds.find((skillId) => (quota.get(skillId) ?? 0) < (bySkill.get(skillId)?.length ?? 0));
    if (receiver === undefined) break;
    quota.set(receiver, (quota.get(receiver) ?? 0) + 1);
    overflow -= 1;
  }

  const selected: typeof bank = [];
  const used = new Set<number>();
  for (const skillId of skillIds) {
    const pool = bySkill.get(skillId) ?? [];
    const unseen = orderDifficultyBalanced(pool.filter((question) => !seen.has(question._id)));
    const previouslySeen = orderDifficultyBalanced(pool.filter((question) => seen.has(question._id)));
    const take = quota.get(skillId) ?? 0;
    const candidates = [...unseen, ...previouslySeen].slice(0, take);
    candidates.forEach((question) => used.add(question._id));
    selected.push(...candidates);
  }
  if (selected.length < MAX_ATTEMPT_QUESTIONS) {
    const remaining = shuffle(bank.filter((question) => !used.has(question._id)));
    selected.push(...remaining.slice(0, MAX_ATTEMPT_QUESTIONS - selected.length));
  }
  return shuffle(selected);
}

async function questionIdsForAttempt(attempt: AssessmentAttemptDoc, session?: ClientSession): Promise<number[]> {
  const query = AssessmentAttemptQuestion.find({ attemptId: attempt._id }).sort({ displayOrder: 1 });
  if (session) query.session(session);
  const attemptQuestions = await query.lean();
  if (attemptQuestions.length) return attemptQuestions.map((item) => item.questionId);

  const legacyQuery = AssessmentQuestion.find({ assessmentId: attempt.assessmentId, active: true }).sort({ displayOrder: 1 });
  if (session) legacyQuery.session(session);
  const legacy = await legacyQuery.lean();
  return seededShuffle(legacy, attempt._id).map((question) => question._id);
}

async function loadQuestionPayload(attempt: AssessmentAttemptDoc, questionIds: number[], session?: ClientSession) {
  const [questions, options, answers] = await Promise.all([
    (session ? AssessmentQuestion.find({ _id: { $in: questionIds } }).session(session) : AssessmentQuestion.find({ _id: { $in: questionIds } })).lean(),
    (session ? QuestionOption.find({ questionId: { $in: questionIds } }).session(session) : QuestionOption.find({ questionId: { $in: questionIds } })).lean(),
    (session ? AssessmentAnswer.find({ attemptId: attempt._id }).session(session) : AssessmentAnswer.find({ attemptId: attempt._id })).lean(),
  ]);
  const skillQuery = Skill.find({ _id: { $in: questions.map((question) => question.skillId) } });
  if (session) skillQuery.session(session);
  const skills = questions.length ? await skillQuery.lean() : [];
  const orderedQuestions = new Map(questions.map((question) => [question._id, question]));
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  const optionsByQuestion = new Map<number, typeof options>();
  for (const option of options) {
    const values = optionsByQuestion.get(option.questionId) || [];
    values.push(option);
    optionsByQuestion.set(option.questionId, values);
  }
  const selectedByQuestion = new Map(answers.map((answer) => [answer.questionId, answer.selectedOptionId]));

  return questionIds.flatMap((questionId, index) => {
    const question = orderedQuestions.get(questionId);
    if (!question) return [];
    const skill = skillById.get(question.skillId);
    if (!skill) throw AppError.internal("Assessment question skill is missing");
    const optionsForQuestion = optionsByQuestion.get(questionId) || [];
    const shuffledOptions = seededShuffle(optionsForQuestion, attempt._id * 1_000_003 + questionId * 31 + 17);
    return [{
      questionId,
      displayOrder: question.displayOrder ?? index,
      skillName: skill.name,
      skillCategory: skill.category,
      questionText: question.questionText,
      difficulty: question.difficulty,
      selectedOptionId: selectedByQuestion.get(questionId) ?? null,
      options: shuffledOptions.map((option) => ({
        optionId: option._id,
        optionText: option.optionText,
        displayOrder: option.displayOrder,
      })),
    }];
  });
}

async function scorePayload(attemptId: number, session?: ClientSession) {
  const scoreQuery = SkillScore.find({ attemptId }).sort({ weightPercent: -1, _id: 1 });
  if (session) scoreQuery.session(session);
  const scores = await scoreQuery.lean();
  const skillQuery = Skill.find({ _id: { $in: scores.map((score) => score.skillId) } });
  if (session) skillQuery.session(session);
  const skills = scores.length ? await skillQuery.lean() : [];
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  return scores.map((score) => {
    const skill = skillById.get(score.skillId);
    if (!skill) throw AppError.internal("Assessment skill score is incomplete");
    return {
      skillId: score.skillId,
      skillName: skill.name,
      skillCategory: skill.category,
      weightPercent: score.weightPercent,
      targetPercent: score.targetPercent,
      questionCount: score.questionCount,
      correctCount: score.correctCount,
      scorePercent: score.scorePercent,
      level: score.level,
    };
  });
}

async function loadAssessment(attempt: AssessmentAttemptDoc, session?: ClientSession) {
  const query = AssessmentTest.findById(attempt.assessmentId);
  if (session) query.session(session);
  const assessment = await query.lean();
  if (!assessment) throw AppError.notFound(`Assessment not found: ${attempt.assessmentId}`);
  const careerQuery = Career.findById(assessment.careerId);
  if (session) careerQuery.session(session);
  const career = await careerQuery.lean();
  if (!career) throw AppError.internal("Assessment career is missing");
  return { assessment, career };
}

function attemptExpired(attempt: AssessmentAttemptDoc): boolean {
  return Date.now() > new Date(attempt.expiresAt).getTime();
}

async function expireAttempt(attemptId: number, session?: ClientSession) {
  const update = AssessmentAttempt.updateOne(
    { _id: attemptId, status: "IN_PROGRESS" },
    { $set: { status: "EXPIRED" } },
  );
  if (session) update.session(session);
  await update;
}

async function ownedAttempt(attemptId: number, userId: number, session?: ClientSession) {
  const query = AssessmentAttempt.findById(attemptId);
  if (session) query.session(session);
  const attempt = await query.lean();
  if (!attempt) throw AppError.notFound(`Attempt not found: ${attemptId}`);
  if (attempt.userId !== userId) throw AppError.forbidden("You do not have access to this attempt");
  return attempt;
}

async function buildStartResponse(attempt: AssessmentAttemptDoc, session?: ClientSession) {
  const [{ assessment, career }, questionIds] = await Promise.all([
    loadAssessment(attempt, session),
    questionIdsForAttempt(attempt, session),
  ]);
  const questions = await loadQuestionPayload(attempt, questionIds, session);
  const answersQuery = AssessmentAnswer.find({ attemptId: attempt._id }).select("questionId");
  if (session) answersQuery.session(session);
  const answers = await answersQuery.lean();
  return {
    attemptId: attempt._id,
    attemptCode: attempt.attemptCode,
    assessmentId: assessment._id,
    assessmentTitle: assessment.title,
    careerId: career._id,
    careerName: career.name,
    durationMinutes: assessment.durationMinutes,
    totalQuestions: attempt.totalQuestions,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    answeredQuestionIds: answers.map((answer) => answer.questionId),
    questions,
  };
}

async function createAttempt(assessmentId: number, userId: number) {
  return withTransaction(async (session) => {
    const assessment = await AssessmentTest.findOne({ _id: assessmentId, published: true }).session(session).lean();
    if (!assessment) throw AppError.notFound(`Assessment not found or not available: ${assessmentId}`);

    const profile = await StudentProfile.findOne({ userId }).session(session).lean();
    if (!profile) throw AppError.notFound(`Student profile not found for user ${userId}`);
    if (profile.targetCareerId && profile.targetCareerId !== assessment.careerId) {
      const [assessmentCareer, targetCareer] = await Promise.all([
        Career.findById(assessment.careerId).session(session).lean(),
        Career.findById(profile.targetCareerId).session(session).lean(),
      ]);
      throw AppError.forbidden(
        `This assessment belongs to '${assessmentCareer?.name || "another career"}' but your target career is '${targetCareer?.name || profile.targetCareerName || "another career"}'. Select the matching career first.`,
      );
    }

    const bank = await AssessmentQuestion.find({ assessmentId, active: true }).session(session).lean();
    if (!bank.length) throw AppError.conflict("This assessment has no questions yet");
    const selected = await selectQuestions(assessmentId, assessment.careerId, userId, bank, session);
    const startedAt = new Date();
    const attemptId = await getNextSequence("assessment_attempts", session);
    const attemptCode = randomUUID().replaceAll("-", "").slice(0, 24);
    const expiresAt = new Date(startedAt.getTime() + assessment.durationMinutes * 60_000);
    const [attempt] = await AssessmentAttempt.create([{
      _id: attemptId,
      attemptCode,
      userId,
      assessmentId,
      status: "IN_PROGRESS",
      startedAt,
      expiresAt,
      totalQuestions: selected.length,
      answeredCount: 0,
      overallScore: null,
      submittedAt: null,
    }], { session });
    for (let displayOrder = 0; displayOrder < selected.length; displayOrder += 1) {
      await AssessmentAttemptQuestion.create([{
        _id: await getNextSequence("assessment_attempt_questions", session),
        attemptId,
        questionId: selected[displayOrder]._id,
        displayOrder,
      }], { session });
    }
    return attempt.toObject() as AssessmentAttemptDoc;
  });
}

export async function startOrResumeAssessment(assessmentId: number, userId: number) {
  const active = await AssessmentAttempt.findOne({ userId, assessmentId, status: "IN_PROGRESS" }).lean();
  if (active && !attemptExpired(active)) return buildStartResponse(active);
  if (active) await expireAttempt(active._id);

  try {
    const created = await createAttempt(assessmentId, userId);
    return buildStartResponse(created);
  } catch (error) {
    if (duplicateKey(error)) {
      const raced = await AssessmentAttempt.findOne({ userId, assessmentId, status: "IN_PROGRESS" }).lean();
      if (raced && !attemptExpired(raced)) return buildStartResponse(raced);
    }
    throw error;
  }
}

export async function getAssessmentAttemptState(attemptId: number, userId: number) {
  let attempt = await ownedAttempt(attemptId, userId);
  if (attempt.status === "IN_PROGRESS" && attemptExpired(attempt)) {
    await expireAttempt(attemptId);
    attempt = { ...attempt, status: "EXPIRED" };
  }
  const [{ assessment, career }, questionIds] = await Promise.all([
    loadAssessment(attempt),
    attempt.status === "IN_PROGRESS" ? questionIdsForAttempt(attempt) : Promise.resolve([]),
  ]);
  const [questions, skills, answers] = await Promise.all([
    attempt.status === "IN_PROGRESS" ? loadQuestionPayload(attempt, questionIds) : Promise.resolve(null),
    attempt.status === "SUBMITTED" ? scorePayload(attemptId) : Promise.resolve(null),
    attempt.status === "IN_PROGRESS" ? AssessmentAnswer.find({ attemptId }).select("questionId").lean() : Promise.resolve([]),
  ]);
  return {
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
    overallScore: attempt.overallScore ?? null,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt ?? null,
    answeredQuestionIds: answers.map((answer) => answer.questionId),
    questions,
    skills,
  };
}

export async function latestAssessmentAttempt(assessmentId: number, userId: number) {
  const attempt = await AssessmentAttempt.findOne({ userId, assessmentId }).sort({ startedAt: -1 }).lean();
  return attempt ? getAssessmentAttemptState(attempt._id, userId) : null;
}

export async function saveAssessmentAnswer(attemptId: number, userId: number, questionId: number, optionId: number) {
  const result = await withTransaction(async (session) => {
    const attempt = await ownedAttempt(attemptId, userId, session);
    if (attempt.status !== "IN_PROGRESS") throw AppError.badRequest("This attempt has already been submitted");
    if (attemptExpired(attempt)) {
      await expireAttempt(attemptId, session);
      return { expired: true as const };
    }
    const question = await AssessmentQuestion.findById(questionId).session(session).lean();
    if (!question || question.assessmentId !== attempt.assessmentId) {
      throw AppError.badRequest(`Question does not belong to this assessment`);
    }
    const attemptQuestionCount = await AssessmentAttemptQuestion.countDocuments({ attemptId }).session(session);
    if (attemptQuestionCount > 0 && !(await AssessmentAttemptQuestion.exists({ attemptId, questionId }).session(session))) {
      throw AppError.badRequest("Question does not belong to this attempt");
    }
    const option = await QuestionOption.findById(optionId).session(session).lean();
    if (!option) throw AppError.badRequest(`Option not found: ${optionId}`);
    if (option.questionId !== questionId) throw AppError.badRequest("Option does not belong to this question");

    const existing = await AssessmentAnswer.findOne({ attemptId, questionId }).session(session).lean();
    if (existing) {
      await AssessmentAnswer.updateOne({ _id: existing._id }, { $set: { selectedOptionId: optionId } }, { session });
    } else {
      await AssessmentAnswer.create([{
        _id: await getNextSequence("assessment_answers", session),
        attemptId,
        questionId,
        selectedOptionId: optionId,
      }], { session });
    }
    const answers = await AssessmentAnswer.find({ attemptId }).select("questionId").sort({ questionId: 1 }).session(session).lean();
    await AssessmentAttempt.updateOne({ _id: attemptId }, { $set: { answeredCount: answers.length } }, { session });
    return {
      expired: false as const,
      data: { attemptId, answeredCount: answers.length, totalQuestions: attempt.totalQuestions, answeredQuestionIds: answers.map((answer) => answer.questionId) },
    };
  });
  if (result.expired) throw AppError.gone("The time limit for this attempt has expired");
  return result.data;
}

export async function submitAssessmentAttempt(attemptId: number, userId: number) {
  const result = await withTransaction(async (session) => {
    const attempt = await ownedAttempt(attemptId, userId, session);
    if (attempt.status !== "IN_PROGRESS") throw AppError.badRequest("This attempt has already been submitted");
    if (attemptExpired(attempt)) {
      await expireAttempt(attemptId, session);
      return { expired: true as const };
    }
    const [{ assessment, career }, questionIds] = await Promise.all([
      loadAssessment(attempt, session),
      questionIdsForAttempt(attempt, session),
    ]);
    const [questions, answers, framework] = await Promise.all([
      AssessmentQuestion.find({ _id: { $in: questionIds } }).session(session).lean(),
      AssessmentAnswer.find({ attemptId }).session(session).lean(),
      CareerSkill.find({ careerId: career._id }).session(session).lean(),
    ]);
    const questionById = new Map(questions.map((question) => [question._id, question]));
    const optionIds = answers.map((answer) => answer.selectedOptionId);
    const options = optionIds.length ? await QuestionOption.find({ _id: { $in: optionIds } }).session(session).lean() : [];
    const correctOptionIds = new Set(options.filter((option) => option.correct).map((option) => option._id));
    const correctBySkill = new Map<number, number>();
    const questionsBySkill = new Map<number, number[]>();
    for (const question of questions) {
      const group = questionsBySkill.get(question.skillId) || [];
      group.push(question._id);
      questionsBySkill.set(question.skillId, group);
    }
    for (const answer of answers) {
      const question = questionById.get(answer.questionId);
      if (question && correctOptionIds.has(answer.selectedOptionId)) {
        correctBySkill.set(question.skillId, (correctBySkill.get(question.skillId) ?? 0) + 1);
      }
    }
    const frameworkBySkill = new Map(framework.map((row) => [row.skillId, row]));
    const skillIds = [...questionsBySkill.keys()];
    const skills = skillIds.length ? await Skill.find({ _id: { $in: skillIds } }).session(session).lean() : [];
    const skillById = new Map(skills.map((skill) => [skill._id, skill]));
    const scoreDocs = [];
    for (const [skillId, questionIdsForSkill] of questionsBySkill) {
      const skill = skillById.get(skillId);
      if (!skill) throw AppError.internal("Assessment skill is missing");
      const questionCount = questionIdsForSkill.length;
      const correctCount = correctBySkill.get(skillId) ?? 0;
      const scorePercent = questionCount ? Math.round((correctCount * 100) / questionCount) : 0;
      const mapping = frameworkBySkill.get(skillId);
      scoreDocs.push({
        _id: await getNextSequence("skill_scores", session),
        attemptId,
        skillId,
        scorePercent,
        correctCount,
        questionCount,
        weightPercent: mapping?.weightPercent ?? 0,
        targetPercent: mapping?.targetPercent ?? DEFAULT_TARGET_PERCENT,
        level: resultLevel(scorePercent),
      });
    }
    const totalWeight = scoreDocs.reduce((sum, score) => sum + score.weightPercent, 0);
    const overallScore = scoreDocs.length
      ? totalWeight > 0
        ? Math.round(scoreDocs.reduce((sum, score) => sum + score.weightPercent * score.scorePercent, 0) / totalWeight)
        : Math.round(scoreDocs.reduce((sum, score) => sum + score.scorePercent, 0) / scoreDocs.length)
      : 0;
    const submittedAt = new Date();
    await AssessmentAttempt.updateOne({ _id: attemptId }, {
      $set: { status: "SUBMITTED", submittedAt, overallScore, answeredCount: answers.length },
    }, { session });
    if (scoreDocs.length) await SkillScore.insertMany(scoreDocs, { session });
    const resultScores = scoreDocs.map((score) => ({
      skillId: score.skillId,
      skillName: skillById.get(score.skillId)!.name,
      skillCategory: skillById.get(score.skillId)!.category,
      weightPercent: score.weightPercent,
      targetPercent: score.targetPercent,
      questionCount: score.questionCount,
      correctCount: score.correctCount,
      scorePercent: score.scorePercent,
      level: score.level,
    }));
    return {
      expired: false as const,
      data: {
        attemptId,
        assessmentId: assessment._id,
        assessmentTitle: assessment.title,
        careerId: career._id,
        careerName: career.name,
        status: "SUBMITTED",
        startedAt: attempt.startedAt,
        submittedAt,
        totalQuestions: attempt.totalQuestions,
        answeredCount: answers.length,
        overallScore,
        skills: resultScores,
      },
    };
  });
  if (result.expired) throw AppError.gone("The time limit for this attempt has expired");
  return result.data;
}

export async function submittedAttemptHistory(userId: number, assessmentId?: number) {
  const filter: Record<string, unknown> = { userId, status: "SUBMITTED" };
  if (assessmentId !== undefined) filter.assessmentId = assessmentId;
  const attempts = await AssessmentAttempt.find(filter).sort({ startedAt: -1 }).lean();
  if (!attempts.length) return [];
  const assessments = await AssessmentTest.find({ _id: { $in: attempts.map((attempt) => attempt.assessmentId) } }).lean();
  const assessmentById = new Map(assessments.map((assessment) => [assessment._id, assessment]));
  const careerIds = [...new Set(assessments.map((assessment) => assessment.careerId))];
  const careerDocs = await Career.find({ _id: { $in: careerIds } }).lean();
  const careerById = new Map(careerDocs.map((career) => [career._id, career]));
  return attempts.flatMap((attempt) => {
    const assessment = assessmentById.get(attempt.assessmentId);
    const career = assessment ? careerById.get(assessment.careerId) : undefined;
    if (!assessment || !career) return [];
    return [{
      attemptId: attempt._id,
      assessmentId: assessment._id,
      assessmentTitle: assessment.title,
      careerId: career._id,
      careerName: career.name,
      status: attempt.status,
      overallScore: attempt.overallScore ?? null,
      totalQuestions: attempt.totalQuestions,
      answeredCount: attempt.answeredCount,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt ?? null,
    }];
  });
}

export async function studentReadiness(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile?.targetCareerId) {
    return {
      targetCareerId: null, targetCareerName: null, hasTarget: false, readinessPercent: null,
      readinessLevel: null, totalSkills: 0, assessedSkills: 0, metSkills: 0,
      submittedAttempts: 0, latestAttempt: null, strengths: [], improvements: [], gaps: [],
    };
  }
  const [career, framework] = await Promise.all([
    Career.findById(profile.targetCareerId).lean(),
    CareerSkill.find({ careerId: profile.targetCareerId }).sort({ weightPercent: -1, _id: 1 }).lean(),
  ]);
  if (!career) throw AppError.internal("Student target career is missing");
  const assessments = await AssessmentTest.find({ careerId: career._id }).select("_id").lean();
  const attempts = assessments.length
    ? await AssessmentAttempt.find({ userId, assessmentId: { $in: assessments.map((item) => item._id) }, status: "SUBMITTED" }).sort({ startedAt: -1 }).lean()
    : [];
  const skillScores = attempts.length
    ? await SkillScore.find({ attemptId: { $in: attempts.map((item) => item._id) } }).lean()
    : [];
  const attemptById = new Map(attempts.map((attempt) => [attempt._id, attempt]));
  const latestBySkill = new Map<number, (typeof skillScores)[number]>();
  for (const attempt of attempts) {
    for (const score of skillScores) {
      if (score.attemptId === attempt._id && !latestBySkill.has(score.skillId)) latestBySkill.set(score.skillId, score);
    }
  }
  const skillIds = [...new Set(framework.map((mapping) => mapping.skillId))];
  const skills = skillIds.length ? await Skill.find({ _id: { $in: skillIds } }).lean() : [];
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  const gaps = framework.flatMap((mapping) => {
    const skill = skillById.get(mapping.skillId);
    if (!skill) return [];
    const score = latestBySkill.get(mapping.skillId);
    const assessed = Boolean(score);
    return [{
      skillId: mapping.skillId, skillName: skill.name, skillCategory: skill.category,
      weightPercent: mapping.weightPercent, requiredLevel: mapping.requiredLevel,
      targetPercent: mapping.targetPercent, scorePercent: score?.scorePercent ?? null,
      correctCount: score?.correctCount ?? null, questionCount: score?.questionCount ?? null,
      gapPercent: score ? score.scorePercent - mapping.targetPercent : null,
      metTarget: score ? score.scorePercent >= mapping.targetPercent : false,
      assessed, level: score?.level ?? null,
      sourceAttemptId: score ? attemptById.get(score.attemptId)?._id ?? null : null,
    }];
  });
  const assessed = gaps.filter((gap) => gap.assessed);
  const met = gaps.filter((gap) => gap.assessed && gap.metTarget);
  const weightedTarget = gaps.reduce((sum, gap) => sum + (gap.targetPercent > 0 ? gap.weightPercent * gap.targetPercent : 0), 0);
  const weightedScore = gaps.reduce((sum, gap) => sum + (gap.targetPercent > 0 && gap.scorePercent !== null ? gap.weightPercent * Math.min(gap.scorePercent, gap.targetPercent) : 0), 0);
  const readinessPercent = weightedTarget > 0
    ? Math.round(weightedScore * 100 / weightedTarget)
    : assessed.length ? Math.round(assessed.reduce((sum, gap) => sum + (gap.scorePercent ?? 0), 0) / assessed.length) : 0;
  const latest = attempts[0];
  const latestHistory = latest ? (await submittedAttemptHistory(userId)).find((item) => item.attemptId === latest._id) ?? null : null;
  return {
    targetCareerId: career._id, targetCareerName: career.name, hasTarget: true,
    readinessPercent, readinessLevel: resultLevel(readinessPercent), totalSkills: gaps.length,
    assessedSkills: assessed.length, metSkills: met.length, submittedAttempts: attempts.length,
    latestAttempt: latestHistory,
    strengths: [...met].sort((a, b) => (b.scorePercent ?? 0) - (a.scorePercent ?? 0)).slice(0, 3),
    improvements: [...gaps.filter((gap) => !gap.metTarget)].sort((a, b) => (a.gapPercent ?? Number.MIN_SAFE_INTEGER) - (b.gapPercent ?? Number.MIN_SAFE_INTEGER)).slice(0, 3),
    gaps,
  };
}

import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import { Career, type CareerDoc } from "../../models/Career.js";
import { CareerSkill, type CareerSkillDoc } from "../../models/CareerSkill.js";
import { Skill, type SkillDoc } from "../../models/Skill.js";
import { AssessmentTest, type AssessmentTestDoc } from "../../models/AssessmentTest.js";
import { AssessmentQuestion, type AssessmentQuestionDoc } from "../../models/AssessmentQuestion.js";
import { QuestionOption, type QuestionOptionDoc } from "../../models/QuestionOption.js";
import { AssessmentAnswer } from "../../models/AssessmentAnswer.js";
import { AssessmentAttemptQuestion } from "../../models/AssessmentAttemptQuestion.js";
import { AssessmentAttempt } from "../../models/AssessmentAttempt.js";
import { Project } from "../../models/Project.js";
import { RoadmapPhase } from "../../models/RoadmapPhase.js";
import { User } from "../../models/User.js";
import { env } from "../../config/env.js";

export async function getAdminMe(userId: number) {
  const user = await User.findById(userId).lean();
  if (!user) throw AppError.notFound("User not found");
  return { id: user._id, email: user.email, fullName: user.fullName, role: user.role, status: user.status };
}

export function getAiStatus() {
  return { configured: Boolean(env.googleClientId), provider: "gemini", model: "gemini-1.5-flash" };
}

// ---------------- Careers & Competency Framework ----------------

export async function listCareers() {
  const careers = await Career.find().sort({ name: 1, _id: 1 }).lean<CareerDoc[]>();
  const careerIds = careers.map((c) => c._id);
  const counts = await CareerSkill.aggregate<{ _id: number; count: number }>([
    { $match: { careerId: { $in: careerIds } } },
    { $group: { _id: "$careerId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id, c.count]));

  return careers.map((c) => ({
    id: c._id,
    name: c.name,
    description: c.description ?? null,
    category: c.category,
    difficultyLevel: c.difficultyLevel,
    published: c.published,
    skillCount: countMap.get(c._id) ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

export async function getCareer(id: number) {
  const career = await Career.findById(id).lean<CareerDoc>();
  if (!career) throw AppError.notFound("Career not found");

  const careerSkills = await CareerSkill.find({ careerId: id }).sort({ weightPercent: -1 }).lean<CareerSkillDoc[]>();
  const skillIds = careerSkills.map((cs) => cs.skillId);
  const skills = skillIds.length > 0 ? await Skill.find({ _id: { $in: skillIds } }).lean<SkillDoc[]>() : [];
  const skillMap = new Map(skills.map((s) => [s._id, s]));

  const framework = careerSkills.map((cs) => {
    const s = skillMap.get(cs.skillId);
    return {
      skillId: cs.skillId,
      skillName: s?.name ?? `Skill #${cs.skillId}`,
      skillCategory: s?.category ?? "OTHER",
      weightPercent: cs.weightPercent,
      requiredLevel: cs.requiredLevel,
      targetPercent: cs.targetPercent,
    };
  });

  return {
    id: career._id,
    name: career.name,
    description: career.description ?? null,
    category: career.category,
    difficultyLevel: career.difficultyLevel,
    published: career.published,
    skills: framework,
    createdAt: career.createdAt,
    updatedAt: career.updatedAt,
  };
}

export async function createCareer(input: any) {
  const trimmedName = input.name.trim();
  const exists = await Career.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, "i") } }).lean();
  if (exists) throw AppError.conflict("A career with this name already exists");

  const [career] = await Career.create([{
    _id: await getNextSequence("careers"),
    name: trimmedName,
    description: input.description ?? null,
    category: input.category,
    difficultyLevel: input.difficultyLevel,
    published: input.published ?? false,
  }]);

  if (Array.isArray(input.skills) && input.skills.length > 0) {
    await replaceCareerSkills(career._id, input.skills);
  }

  return getCareer(career._id);
}

export async function updateCareer(id: number, input: any) {
  const career = await Career.findById(id);
  if (!career) throw AppError.notFound("Career not found");

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    const duplicate = await Career.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${trimmed}$`, "i") },
    }).lean();
    if (duplicate) throw AppError.conflict("A career with this name already exists");
    career.name = trimmed;
  }
  if (input.description !== undefined) career.description = input.description;
  if (input.category !== undefined) career.category = input.category;
  if (input.difficultyLevel !== undefined) career.difficultyLevel = input.difficultyLevel;
  if (input.published !== undefined) career.published = input.published;
  await career.save();

  if (Array.isArray(input.skills)) {
    await replaceCareerSkills(id, input.skills);
  }

  return getCareer(id);
}

export async function replaceCareerSkills(careerId: number, skillsInput: any[]) {
  const career = await Career.findById(careerId);
  if (!career) throw AppError.notFound("Career not found");

  if (!Array.isArray(skillsInput) || skillsInput.length === 0) {
    throw AppError.badRequest("At least one skill mapping is required");
  }

  const distinctSkills = new Set(skillsInput.map((s) => s.skillId));
  if (distinctSkills.size !== skillsInput.length) {
    throw AppError.badRequest("A skill can only be mapped once per career");
  }

  const totalWeight = skillsInput.reduce((sum, s) => sum + (Number(s.weightPercent) || 0), 0);
  if (totalWeight !== 100) {
    throw AppError.badRequest(`Skill weights must total exactly 100% (current total: ${totalWeight}%)`);
  }

  const skillIds = skillsInput.map((s) => Number(s.skillId));
  const existingSkills = await Skill.find({ _id: { $in: skillIds } }).lean<SkillDoc[]>();
  const skillMap = new Map(existingSkills.map((s) => [s._id, s]));

  for (const s of skillsInput) {
    if (!skillMap.has(Number(s.skillId))) {
      throw AppError.badRequest(`Skill not found: ${s.skillId}`);
    }
    const target = s.targetPercent != null ? Number(s.targetPercent) : 80;
    if (target < 1 || target > 100) {
      throw AppError.badRequest("Target percent must be between 1 and 100");
    }
  }

  await CareerSkill.deleteMany({ careerId });

  for (const s of skillsInput) {
    const nextId = await getNextSequence("career_skills");
    await CareerSkill.create([{
      _id: nextId,
      careerId,
      skillId: Number(s.skillId),
      weightPercent: Number(s.weightPercent),
      requiredLevel: s.requiredLevel,
      targetPercent: s.targetPercent != null ? Number(s.targetPercent) : 80,
    }]);
  }

  return getCareer(careerId);
}

export async function deleteCareer(id: number) {
  const career = await Career.findById(id);
  if (!career) throw AppError.notFound("Career not found");

  const hasAssessments = await AssessmentTest.exists({ careerId: id });
  if (hasAssessments) {
    throw AppError.conflict("Career is used by assessments and cannot be deleted");
  }

  await CareerSkill.deleteMany({ careerId: id });
  await Career.deleteOne({ _id: id });
  return { deleted: true };
}

// ---------------- Skills ----------------

export async function listSkills() {
  const skills = await Skill.find().sort({ name: 1, _id: 1 }).lean<SkillDoc[]>();
  return skills.map((s) => ({
    id: s._id,
    name: s.name,
    category: s.category,
    description: s.description ?? null,
    active: s.active,
  }));
}

export async function getSkill(id: number) {
  const skill = await Skill.findById(id).lean<SkillDoc>();
  if (!skill) throw AppError.notFound("Skill not found");
  return {
    id: skill._id,
    name: skill.name,
    category: skill.category,
    description: skill.description ?? null,
    active: skill.active,
  };
}

export async function createSkill(input: any) {
  const trimmed = input.name.trim();
  const exists = await Skill.findOne({ name: { $regex: new RegExp(`^${trimmed}$`, "i") } }).lean();
  if (exists) throw AppError.conflict("A skill with this name already exists");

  const [skill] = await Skill.create([{
    _id: await getNextSequence("skills"),
    name: trimmed,
    category: input.category,
    description: input.description ?? null,
    active: input.active ?? true,
  }]);
  return {
    id: skill._id,
    name: skill.name,
    category: skill.category,
    description: skill.description ?? null,
    active: skill.active,
  };
}

export async function updateSkill(id: number, input: any) {
  const skill = await Skill.findById(id);
  if (!skill) throw AppError.notFound("Skill not found");

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    const duplicate = await Skill.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${trimmed}$`, "i") },
    }).lean();
    if (duplicate) throw AppError.conflict("A skill with this name already exists");
    skill.name = trimmed;
  }
  if (input.category !== undefined) skill.category = input.category;
  if (input.description !== undefined) skill.description = input.description;
  if (input.active !== undefined) skill.active = input.active;
  await skill.save();

  return {
    id: skill._id,
    name: skill.name,
    category: skill.category,
    description: skill.description ?? null,
    active: skill.active,
  };
}

export async function deleteSkill(id: number) {
  const skill = await Skill.findById(id);
  if (!skill) throw AppError.notFound("Skill not found");

  const used = await CareerSkill.exists({ skillId: id });
  if (used) {
    throw AppError.conflict("Skill is used in career competency frameworks and cannot be deleted");
  }

  await Skill.deleteOne({ _id: id });
  return { deleted: true };
}

// ---------------- Assessments & Questions ----------------

async function questionToAdminResponse(q: AssessmentQuestionDoc, options: QuestionOptionDoc[], skillMap?: Map<number, SkillDoc>) {
  const skill = skillMap?.get(q.skillId);
  return {
    id: q._id,
    assessmentId: q.assessmentId,
    skillId: q.skillId,
    skillName: skill?.name ?? `Skill #${q.skillId}`,
    questionText: q.questionText,
    questionType: q.questionType,
    difficulty: q.difficulty,
    displayOrder: q.displayOrder,
    explanation: q.explanation ?? null,
    active: q.active,
    options: options.map((opt) => ({
      id: opt._id,
      questionId: opt.questionId,
      optionText: opt.optionText,
      correct: opt.correct,
      displayOrder: opt.displayOrder,
    })),
  };
}

export async function listAssessments() {
  const assessments = await AssessmentTest.find().sort({ createdAt: -1, _id: -1 }).lean<AssessmentTestDoc[]>();
  const careerIds = [...new Set(assessments.map((a) => a.careerId))];
  const careers = careerIds.length > 0 ? await Career.find({ _id: { $in: careerIds } }).lean<CareerDoc[]>() : [];
  const careerMap = new Map(careers.map((c) => [c._id, c]));

  const assessmentIds = assessments.map((a) => a._id);
  const qCounts = await AssessmentQuestion.aggregate<{ _id: number; count: number }>([
    { $match: { assessmentId: { $in: assessmentIds }, active: true } },
    { $group: { _id: "$assessmentId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(qCounts.map((q) => [q._id, q.count]));

  return assessments.map((a) => ({
    id: a._id,
    careerId: a.careerId,
    careerName: careerMap.get(a.careerId)?.name ?? `Career #${a.careerId}`,
    title: a.title,
    description: a.description ?? null,
    durationMinutes: a.durationMinutes,
    published: a.published,
    questionCount: countMap.get(a._id) ?? 0,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));
}

export async function getAssessment(id: number) {
  const assessment = await AssessmentTest.findById(id).lean<AssessmentTestDoc>();
  if (!assessment) throw AppError.notFound("Assessment not found");

  const career = await Career.findById(assessment.careerId).lean<CareerDoc>();
  const questions = await AssessmentQuestion.find({ assessmentId: id })
    .sort({ displayOrder: 1, _id: 1 })
    .lean<AssessmentQuestionDoc[]>();

  const qIds = questions.map((q) => q._id);
  const options = qIds.length > 0
    ? await QuestionOption.find({ questionId: { $in: qIds } }).sort({ displayOrder: 1 }).lean<QuestionOptionDoc[]>()
    : [];
  const optionMap = new Map<number, QuestionOptionDoc[]>();
  for (const opt of options) {
    const list = optionMap.get(opt.questionId) ?? [];
    list.push(opt);
    optionMap.set(opt.questionId, list);
  }

  const skillIds = [...new Set(questions.map((q) => q.skillId))];
  const skills = skillIds.length > 0 ? await Skill.find({ _id: { $in: skillIds } }).lean<SkillDoc[]>() : [];
  const skillMap = new Map(skills.map((s) => [s._id, s]));

  const questionList = await Promise.all(
    questions.map((q) => questionToAdminResponse(q, optionMap.get(q._id) ?? [], skillMap)),
  );

  return {
    id: assessment._id,
    careerId: assessment.careerId,
    careerName: career?.name ?? `Career #${assessment.careerId}`,
    title: assessment.title,
    description: assessment.description ?? null,
    durationMinutes: assessment.durationMinutes,
    published: assessment.published,
    questionCount: questions.filter((q) => q.active).length,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
    questions: questionList,
  };
}

export async function createAssessment(input: any) {
  const career = await Career.findById(input.careerId).lean();
  if (!career) throw AppError.badRequest("Career not found");

  const [assessment] = await AssessmentTest.create([{
    _id: await getNextSequence("assessment_tests"),
    careerId: input.careerId,
    title: input.title.trim(),
    description: input.description ?? null,
    durationMinutes: input.durationMinutes,
    published: input.published ?? false,
  }]);
  return getAssessment(assessment._id);
}

export async function updateAssessment(id: number, input: any) {
  const assessment = await AssessmentTest.findById(id);
  if (!assessment) throw AppError.notFound("Assessment not found");

  if (input.careerId !== undefined) {
    const career = await Career.findById(input.careerId).lean();
    if (!career) throw AppError.badRequest("Career not found");
    assessment.careerId = input.careerId;
  }
  if (input.title !== undefined) assessment.title = input.title.trim();
  if (input.description !== undefined) assessment.description = input.description;
  if (input.durationMinutes !== undefined) assessment.durationMinutes = input.durationMinutes;
  if (input.published !== undefined) assessment.published = input.published;
  await assessment.save();

  return getAssessment(id);
}

export async function deleteAssessment(id: number) {
  const assessment = await AssessmentTest.findById(id);
  if (!assessment) throw AppError.notFound("Assessment not found");

  const hasAttempts = await AssessmentAttempt.exists({ assessmentId: id });
  if (hasAttempts) {
    throw AppError.conflict("Assessment has student attempts and cannot be deleted");
  }

  const questions = await AssessmentQuestion.find({ assessmentId: id }).lean();
  const qIds = questions.map((q) => q._id);
  if (qIds.length > 0) {
    await QuestionOption.deleteMany({ questionId: { $in: qIds } });
    await AssessmentQuestion.deleteMany({ assessmentId: id });
  }

  await AssessmentTest.deleteOne({ _id: id });
  return { deleted: true };
}

// ---------------- Questions Bank ----------------

export async function listAssessmentQuestions(assessmentId: number) {
  const assessment = await AssessmentTest.findById(assessmentId).lean();
  if (!assessment) throw AppError.notFound("Assessment not found");

  const questions = await AssessmentQuestion.find({ assessmentId })
    .sort({ displayOrder: 1, _id: 1 })
    .lean<AssessmentQuestionDoc[]>();

  const qIds = questions.map((q) => q._id);
  const options = qIds.length > 0
    ? await QuestionOption.find({ questionId: { $in: qIds } }).sort({ displayOrder: 1 }).lean<QuestionOptionDoc[]>()
    : [];
  const optionMap = new Map<number, QuestionOptionDoc[]>();
  for (const opt of options) {
    const list = optionMap.get(opt.questionId) ?? [];
    list.push(opt);
    optionMap.set(opt.questionId, list);
  }

  const skillIds = [...new Set(questions.map((q) => q.skillId))];
  const skills = skillIds.length > 0 ? await Skill.find({ _id: { $in: skillIds } }).lean<SkillDoc[]>() : [];
  const skillMap = new Map(skills.map((s) => [s._id, s]));

  return Promise.all(
    questions.map((q) => questionToAdminResponse(q, optionMap.get(q._id) ?? [], skillMap)),
  );
}

function validateQuestionOptions(options: any[]) {
  if (!Array.isArray(options) || options.length < 2) {
    throw AppError.badRequest("A question needs at least 2 options");
  }
  const texts = options.map((opt) => String(opt.optionText ?? "").trim());
  if (texts.some((t) => t.length === 0)) {
    throw AppError.badRequest("Every option needs text");
  }
  const seen = new Set<string>();
  for (const t of texts) {
    const lower = t.toLowerCase();
    if (seen.has(lower)) {
      throw AppError.badRequest("Option text must be unique within a question");
    }
    seen.add(lower);
  }
  const correctCount = options.filter((opt) => opt.correct === true).length;
  if (correctCount !== 1) {
    throw AppError.badRequest("Mark exactly one option as correct");
  }
}

export async function createAssessmentQuestion(assessmentId: number, input: any) {
  const assessment = await AssessmentTest.findById(assessmentId).lean();
  if (!assessment) throw AppError.notFound("Assessment not found");

  const skill = await Skill.findById(input.skillId).lean<SkillDoc>();
  if (!skill) throw AppError.badRequest("Skill not found");

  validateQuestionOptions(input.options);

  let displayOrder = input.displayOrder != null ? Number(input.displayOrder) : null;
  if (displayOrder == null) {
    const maxQ = await AssessmentQuestion.findOne({ assessmentId }).sort({ displayOrder: -1 }).lean();
    displayOrder = (maxQ?.displayOrder ?? 0) + 1;
  }

  const questionId = await getNextSequence("assessment_questions");
  const [question] = await AssessmentQuestion.create([{
    _id: questionId,
    assessmentId,
    skillId: Number(input.skillId),
    questionText: input.questionText.trim(),
    questionType: input.questionType || "MCQ",
    difficulty: input.difficulty,
    displayOrder,
    explanation: input.explanation ? String(input.explanation).trim() : null,
    active: input.active !== false,
  }]);

  const createdOptions: QuestionOptionDoc[] = [];
  for (let i = 0; i < input.options.length; i++) {
    const opt = input.options[i];
    const optionId = await getNextSequence("question_options");
    const [savedOpt] = await QuestionOption.create([{
      _id: optionId,
      questionId,
      optionText: String(opt.optionText).trim(),
      correct: Boolean(opt.correct),
      displayOrder: opt.displayOrder != null ? Number(opt.displayOrder) : i + 1,
    }]);
    createdOptions.push(savedOpt.toObject() as QuestionOptionDoc);
  }

  const skillMap = new Map([[skill._id, skill]]);
  return questionToAdminResponse(question.toObject() as AssessmentQuestionDoc, createdOptions, skillMap);
}

export async function updateAssessmentQuestion(questionId: number, input: any) {
  const question = await AssessmentQuestion.findById(questionId);
  if (!question) throw AppError.notFound("Question not found");

  if (input.skillId !== undefined) {
    const skill = await Skill.findById(input.skillId).lean();
    if (!skill) throw AppError.badRequest("Skill not found");
    question.skillId = Number(input.skillId);
  }
  if (input.assessmentId !== undefined) {
    const assessment = await AssessmentTest.findById(input.assessmentId).lean();
    if (!assessment) throw AppError.badRequest("Assessment not found");
    question.assessmentId = Number(input.assessmentId);
  }
  if (input.questionText !== undefined) question.questionText = input.questionText.trim();
  if (input.questionType !== undefined) question.questionType = input.questionType;
  if (input.difficulty !== undefined) question.difficulty = input.difficulty;
  if (input.explanation !== undefined) question.explanation = input.explanation ? String(input.explanation).trim() : null;
  if (input.displayOrder !== undefined && input.displayOrder !== null) question.displayOrder = Number(input.displayOrder);
  if (input.active !== undefined) question.active = Boolean(input.active);

  if (Array.isArray(input.options)) {
    validateQuestionOptions(input.options);
    await QuestionOption.deleteMany({ questionId });
    for (let i = 0; i < input.options.length; i++) {
      const opt = input.options[i];
      const optionId = await getNextSequence("question_options");
      await QuestionOption.create([{
        _id: optionId,
        questionId,
        optionText: String(opt.optionText).trim(),
        correct: Boolean(opt.correct),
        displayOrder: opt.displayOrder != null ? Number(opt.displayOrder) : i + 1,
      }]);
    }
  }

  await question.save();

  const options = await QuestionOption.find({ questionId }).sort({ displayOrder: 1 }).lean<QuestionOptionDoc[]>();
  const skill = await Skill.findById(question.skillId).lean<SkillDoc>();
  const skillMap = skill ? new Map([[skill._id, skill]]) : undefined;

  return questionToAdminResponse(question.toObject() as AssessmentQuestionDoc, options, skillMap);
}

export async function deleteAssessmentQuestion(questionId: number) {
  const question = await AssessmentQuestion.findById(questionId);
  if (!question) throw AppError.notFound("Question not found");

  const hasAnswers = await AssessmentAnswer.exists({ questionId });
  const hasAttemptQuestions = await AssessmentAttemptQuestion.exists({ questionId });
  if (hasAnswers || hasAttemptQuestions) {
    throw AppError.conflict("Question has student attempts and cannot be deleted");
  }

  await QuestionOption.deleteMany({ questionId });
  await AssessmentQuestion.deleteOne({ _id: questionId });
  return { deleted: true };
}

// ---------------- Projects & Roadmaps ----------------

export async function listProjects() {
  return Project.find().sort({ _id: -1 }).lean();
}

export async function listRoadmaps() {
  return RoadmapPhase.find().sort({ _id: 1 }).lean();
}

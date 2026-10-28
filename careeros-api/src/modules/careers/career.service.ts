import { AppError } from "../../lib/errors.js";
import { Career } from "../../models/Career.js";
import { CareerSkill, type CareerSkillDoc } from "../../models/CareerSkill.js";
import { Skill } from "../../models/Skill.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import type { StudentProfileDoc } from "../../models/StudentProfile.js";
import { toStudentProfileResponse } from "../auth/user.mapper.js";

function parseCareerSkillRows(
  rows: Array<Pick<CareerSkillDoc, "skillId" | "weightPercent" | "requiredLevel" | "targetPercent">>,
  skillById: Map<number, { name: string; category: string }>,
) {
  return rows.map((row) => {
    const skill = skillById.get(row.skillId);
    if (!skill) throw AppError.internal("Career competency data is incomplete");
    return {
      skillId: row.skillId,
      skillName: skill.name,
      skillCategory: skill.category,
      weightPercent: row.weightPercent,
      requiredLevel: row.requiredLevel,
      targetPercent: row.targetPercent,
    };
  });
}

async function getCareerSkills(careerId: number) {
  const rows = await CareerSkill.find({ careerId }).sort({ weightPercent: -1, _id: 1 }).lean();
  const skillIds = rows.map((row) => row.skillId);
  const skills = skillIds.length ? await Skill.find({ _id: { $in: skillIds } }).lean() : [];
  return parseCareerSkillRows(
    rows,
    new Map(skills.map((skill) => [skill._id, { name: skill.name, category: skill.category }])),
  );
}

export async function listPublishedCareers() {
  const careers = await Career.find({ published: true }).sort({ name: 1 }).lean();
  if (!careers.length) return [];
  const counts = await CareerSkill.aggregate<{ _id: number; count: number }>([
    { $match: { careerId: { $in: careers.map((career) => career._id) } } },
    { $group: { _id: "$careerId", count: { $sum: 1 } } },
  ]);
  const countByCareerId = new Map(counts.map((entry) => [entry._id, entry.count]));
  return careers.map((career) => ({
    id: career._id,
    name: career.name,
    description: career.description ?? null,
    category: career.category,
    difficultyLevel: career.difficultyLevel,
    published: career.published,
    skillCount: countByCareerId.get(career._id) ?? 0,
  }));
}

async function requirePublishedCareer(careerId: number) {
  const career = await Career.findOne({ _id: careerId, published: true }).lean();
  if (!career) throw AppError.notFound(`Career not found: ${careerId}`);
  return career;
}

export async function getPublishedCareer(careerId: number) {
  const [career, skills] = await Promise.all([
    requirePublishedCareer(careerId),
    getCareerSkills(careerId),
  ]);
  return {
    id: career._id,
    name: career.name,
    description: career.description ?? null,
    category: career.category,
    difficultyLevel: career.difficultyLevel,
    published: career.published,
    skills,
    createdAt: career.createdAt.toISOString(),
    updatedAt: career.updatedAt.toISOString(),
  };
}

export async function listPublishedCareerSkills(careerId: number) {
  await requirePublishedCareer(careerId);
  return getCareerSkills(careerId);
}

export async function setStudentTargetCareer(userId: number, email: string, careerId: number) {
  const career = await Career.findOne({ _id: careerId, published: true }).lean();
  if (!career) throw AppError.notFound(`Career not found or not available: ${careerId}`);

  const profile = await StudentProfile.findOneAndUpdate(
    { userId },
    { $set: { targetCareerId: career._id, targetCareerName: career.name } },
    { new: true, runValidators: true },
  ).lean() as StudentProfileDoc | null;
  if (!profile) throw AppError.notFound(`Student profile not found for user ${userId}`);
  return toStudentProfileResponse(profile, email);
}

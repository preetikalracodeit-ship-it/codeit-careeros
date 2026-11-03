import { withTransaction } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { Career } from "../../models/Career.js";
import { CareerSkill } from "../../models/CareerSkill.js";
import { Skill } from "../../models/Skill.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { getStudentProfile } from "../students/student.service.js";

function toSkillResponse(
  row: { skillId: number; weightPercent: number; requiredLevel: string; targetPercent: number },
  skill: { _id: number; name: string; category: string },
) {
  return {
    skillId: skill._id,
    skillName: skill.name,
    skillCategory: skill.category,
    weightPercent: row.weightPercent,
    requiredLevel: row.requiredLevel,
    targetPercent: row.targetPercent,
  };
}

async function getSkills(careerId: number) {
  const rows = await CareerSkill.find({ careerId }).sort({ weightPercent: -1 }).lean();
  const skills = await Skill.find({ _id: { $in: rows.map((row) => row.skillId) } }).lean();
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  return rows.flatMap((row) => {
    const skill = skillById.get(row.skillId);
    return skill ? [toSkillResponse(row, skill)] : [];
  });
}

export async function listPublishedCareers() {
  const careers = await Career.find({ published: true }).sort({ name: 1 }).lean();
  const counts = await CareerSkill.aggregate<{ _id: number; count: number }>([
    { $match: { careerId: { $in: careers.map((career) => career._id) } } },
    { $group: { _id: "$careerId", count: { $sum: 1 } } },
  ]);
  const countByCareerId = new Map(counts.map((row) => [row._id, row.count]));
  return careers.map((career) => ({
    id: career._id,
    name: career.name,
    ...(career.description == null ? {} : { description: career.description }),
    category: career.category,
    difficultyLevel: career.difficultyLevel,
    published: career.published,
    skillCount: countByCareerId.get(career._id) ?? 0,
  }));
}

export async function getPublishedCareer(id: number) {
  const career = await Career.findOne({ _id: id, published: true }).lean();
  if (!career) {
    throw AppError.notFound(`Career not found: ${id}`);
  }
  return {
    id: career._id,
    name: career.name,
    ...(career.description == null ? {} : { description: career.description }),
    category: career.category,
    difficultyLevel: career.difficultyLevel,
    published: career.published,
    skills: await getSkills(id),
    createdAt: career.createdAt.toISOString(),
    updatedAt: career.updatedAt.toISOString(),
  };
}

export async function getPublishedCareerSkills(id: number) {
  const career = await Career.exists({ _id: id, published: true });
  if (!career) {
    throw AppError.notFound(`Career not found: ${id}`);
  }
  return getSkills(id);
}

export async function setTargetCareer(userId: number, careerId: number) {
  await withTransaction(async (session) => {
    const profile = await StudentProfile.findOne({ userId }).session(session);
    if (!profile) {
      throw AppError.notFound(`Student profile not found for user ${userId}`);
    }
    const career = await Career.findOne({ _id: careerId, published: true }).session(session);
    if (!career) {
      throw AppError.notFound(`Career not found or not available: ${careerId}`);
    }
    profile.targetCareerId = career._id;
    profile.targetCareerName = career.name;
    await profile.save({ session });
  });

  return getStudentProfile(userId);
}

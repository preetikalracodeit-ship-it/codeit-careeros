import { AppError } from "../../lib/errors.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { User } from "../../models/User.js";
import { toStudentProfileResponse } from "../auth/user.mapper.js";
import type { StudentProfileUpdateInput } from "./studentProfile.schemas.js";

export async function getCurrentStudentProfile(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile) throw AppError.notFound("Student profile not found");
  const user = await User.findById(userId).select("email").lean();
  if (!user) throw AppError.notFound("Student profile not found");
  return toStudentProfileResponse(profile, user.email);
}

export async function updateCurrentStudentProfile(
  userId: number,
  input: StudentProfileUpdateInput,
) {
  const update = {
    fullName: input.fullName,
    mobile: input.mobile ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    college: input.college ?? null,
    degree: input.degree ?? null,
    branch: input.branch ?? null,
    graduationYear: input.graduationYear ?? null,
    semester: input.semester ?? null,
    location: input.location ?? null,
    githubUrl: input.githubUrl ?? null,
    linkedinUrl: input.linkedinUrl ?? null,
    portfolioUrl: input.portfolioUrl ?? null,
  };
  const profile = await StudentProfile.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, runValidators: true },
  ).lean();
  if (!profile) throw AppError.notFound("Student profile not found");
  const user = await User.findById(userId).select("email").lean();
  if (!user) throw AppError.notFound("Student profile not found");
  return toStudentProfileResponse(profile, user.email);
}

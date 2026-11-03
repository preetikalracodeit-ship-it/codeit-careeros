import { AppError } from "../../lib/errors.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { User } from "../../models/User.js";
import type { UpdateStudentProfileInput } from "./student.schemas.js";

export async function getStudentProfile(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile) {
    throw AppError.notFound(`Student profile not found for user ${userId}`);
  }
  const user = await User.findById(userId).select("email").lean();
  return {
    id: profile._id,
    studentId: profile.studentId,
    fullName: profile.fullName,
    email: user?.email,
    ...(profile.mobile == null ? {} : { mobile: profile.mobile }),
    ...(profile.dateOfBirth == null ? {} : { dateOfBirth: profile.dateOfBirth }),
    ...(profile.college == null ? {} : { college: profile.college }),
    ...(profile.degree == null ? {} : { degree: profile.degree }),
    ...(profile.branch == null ? {} : { branch: profile.branch }),
    ...(profile.graduationYear == null ? {} : { graduationYear: profile.graduationYear }),
    ...(profile.semester == null ? {} : { semester: profile.semester }),
    ...(profile.location == null ? {} : { location: profile.location }),
    ...(profile.githubUrl == null ? {} : { githubUrl: profile.githubUrl }),
    ...(profile.linkedinUrl == null ? {} : { linkedinUrl: profile.linkedinUrl }),
    ...(profile.portfolioUrl == null ? {} : { portfolioUrl: profile.portfolioUrl }),
    ...(profile.profilePhotoUrl == null ? {} : { profilePhotoUrl: profile.profilePhotoUrl }),
    ...(profile.targetCareerId == null ? {} : { targetCareerId: profile.targetCareerId }),
    ...(profile.targetCareerName == null ? {} : { targetCareerName: profile.targetCareerName }),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function updateStudentProfile(userId: number, input: UpdateStudentProfileInput) {
  const profile = await StudentProfile.findOne({ userId });
  if (!profile) {
    throw AppError.notFound(`Student profile not found for user ${userId}`);
  }

  profile.fullName = input.fullName;
  profile.mobile = input.mobile ?? null;
  profile.dateOfBirth = input.dateOfBirth ?? null;
  profile.college = input.college ?? null;
  profile.degree = input.degree ?? null;
  profile.branch = input.branch ?? null;
  profile.graduationYear = input.graduationYear ?? null;
  profile.semester = input.semester ?? null;
  profile.location = input.location ?? null;
  profile.githubUrl = input.githubUrl ?? null;
  profile.linkedinUrl = input.linkedinUrl ?? null;
  profile.portfolioUrl = input.portfolioUrl ?? null;
  await profile.save();

  return getStudentProfile(userId);
}

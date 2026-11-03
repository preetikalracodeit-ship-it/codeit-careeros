import type { UserDoc } from "../../models/User.js";
import type { StudentProfileDoc } from "../../models/StudentProfile.js";

export interface UserResponse {
  id: number;
  email: string;
  fullName: string;
  role: string;
  collegeId?: number | null;
  departmentId?: number | null;
  createdAt: string;
}

export function toUserResponse(user: UserDoc): UserResponse {
  return {
    id: user._id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    collegeId: user.collegeId ?? null,
    departmentId: user.departmentId ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toStudentProfileResponse(profile: StudentProfileDoc, email?: string) {
  return {
    id: profile._id,
    studentId: profile.studentId,
    fullName: profile.fullName,
    email,
    mobile: profile.mobile ?? null,
    dateOfBirth: profile.dateOfBirth ?? null,
    college: profile.college ?? null,
    degree: profile.degree ?? null,
    branch: profile.branch ?? null,
    graduationYear: profile.graduationYear ?? null,
    semester: profile.semester ?? null,
    location: profile.location ?? null,
    githubUrl: profile.githubUrl ?? null,
    linkedinUrl: profile.linkedinUrl ?? null,
    portfolioUrl: profile.portfolioUrl ?? null,
    profilePhotoUrl: profile.profilePhotoUrl ?? null,
    targetCareerId: profile.targetCareerId ?? null,
    targetCareerName: profile.targetCareerName ?? null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

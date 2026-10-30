import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import { Institution } from "../../models/Institution.js";
import { InstitutionMembership } from "../../models/InstitutionMembership.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { User, STAFF_ROLES, type Role } from "../../models/User.js";
import { recordInstitutionEvent } from "../../lib/audit.js";
import { scopeLabel } from "../invitations/invitation.service.js";

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;

export interface AdminActor {
  id: number;
  email: string;
  fullName: string;
  role: Role;
}

export interface InstitutionResponse {
  id: number;
  code: string;
  name: string;
  timezone: string | null;
  contactEmail: string | null;
  status: "ACTIVE" | "INACTIVE";
  studentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithCollegeResponse {
  id: number;
  fullName: string;
  email: string;
  studentId: string | null;
  college: string | null;
  branch: string | null;
  graduationYear: number | null;
  createdAt: Date;
}

export interface MembershipResponse {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  designation: string;
  scopeType: string;
  scopeId: number | null;
  scopeLabel: string;
  status: string;
  acceptedAt: Date | null;
  createdAt: Date;
}

function isUniqueCode(code: string, excludeId?: number): Promise<boolean> {
  const query = Institution.findOne({ code }).collation({ locale: "en", strength: 2 });
  if (excludeId) query.where("_id").ne(excludeId);
  return query.lean().then(Boolean);
}

function institutionResponse(inst: any): InstitutionResponse {
  return {
    id: inst._id,
    code: inst.code,
    name: inst.name,
    timezone: inst.timezone ?? null,
    contactEmail: inst.contactEmail ?? null,
    status: inst.status,
    studentCount: 0,
    createdAt: inst.createdAt,
    updatedAt: inst.updatedAt,
  };
}

export async function listInstitutions(actor: AdminActor): Promise<InstitutionResponse[]> {
  if (actor.role !== "SUPER_ADMIN") {
    throw AppError.forbidden("Only platform administrators can list institutions.");
  }
  const institutions = await Institution.find().sort({ name: 1, _id: 1 }).lean();
  return institutions.map((inst) => institutionResponse(inst));
}

export async function createInstitution(input: { code: string; name: string; timezone?: string | null; contactEmail?: string | null; status?: "ACTIVE" | "INACTIVE" }, actor: AdminActor): Promise<InstitutionResponse> {
  if (actor.role !== "SUPER_ADMIN") {
    throw AppError.forbidden("Only platform administrators can create institutions.");
  }
  const code = input.code.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    throw AppError.badRequest("Institution code must be 2-40 characters using letters, digits, dot, underscore or hyphen.");
  }
  if (!input.name || input.name.trim().length > 160) {
    throw AppError.badRequest("Institution name is required and must be at most 160 characters.");
  }
  const exists = await isUniqueCode(code);
  if (exists) {
    throw AppError.conflict("An institution with this code already exists.");
  }
  const [institution] = await Institution.create([{
    _id: await getNextSequence("institutions"),
    code,
    name: input.name.trim(),
    timezone: input.timezone ?? null,
    contactEmail: input.contactEmail?.trim().toLowerCase() || null,
    status: input.status ?? "ACTIVE",
  }]);
  await recordInstitutionEvent({ action: "INSTITUTION_CREATE", targetType: "INSTITUTION", targetId: String(institution._id), institutionId: institution._id, details: `code=${institution.code}` });
  return institutionResponse(institution);
}

export async function updateInstitution(institutionId: number, input: { code?: string; name?: string; timezone?: string | null; contactEmail?: string | null; status?: "ACTIVE" | "INACTIVE" }, actor: AdminActor): Promise<InstitutionResponse> {
  if (actor.role !== "SUPER_ADMIN") {
    throw AppError.forbidden("Only platform administrators can update institutions.");
  }
  const institution = await Institution.findById(institutionId);
  if (!institution) throw AppError.notFound("Institution not found.");
  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      throw AppError.badRequest("Institution code must be 2-40 characters using letters, digits, dot, underscore or hyphen.");
    }
    const exists = await isUniqueCode(code, institutionId);
    if (exists) throw AppError.conflict("An institution with this code already exists.");
    institution.code = code;
  }
  if (input.name !== undefined) institution.name = input.name.trim();
  if (input.timezone !== undefined) institution.timezone = input.timezone ?? null;
  if (input.contactEmail !== undefined) institution.contactEmail = input.contactEmail?.trim().toLowerCase() || null;
  if (input.status !== undefined) institution.status = input.status;
  await institution.save();
  await recordInstitutionEvent({ action: "INSTITUTION_UPDATE", targetType: "INSTITUTION", targetId: String(institution._id), institutionId: institution._id, details: `name=${institution.name}` });
  return institutionResponse(institution);
}

export async function toggleInstitutionStatus(institutionId: number, status: "ACTIVE" | "INACTIVE", actor: AdminActor): Promise<InstitutionResponse> {
  if (actor.role !== "SUPER_ADMIN") {
    throw AppError.forbidden("Only platform administrators can change institution status.");
  }
  const institution = await Institution.findById(institutionId);
  if (!institution) throw AppError.notFound("Institution not found.");
  institution.status = status;
  await institution.save();
  await recordInstitutionEvent({ action: "INSTITUTION_STATUS_CHANGE", targetType: "INSTITUTION", targetId: String(institution._id), institutionId: institution._id, details: `status=${status}` });
  return institutionResponse(institution);
}

export async function listAdministrators(institutionId: number, actor: AdminActor): Promise<UserWithCollegeResponse[]> {
  if (actor.role !== "SUPER_ADMIN") {
    throw AppError.forbidden("Only platform administrators can list administrators.");
  }
  const institution = await Institution.findById(institutionId);
  if (!institution) throw AppError.notFound("Institution not found.");
  const memberships = await InstitutionMembership.find({ institutionId, status: "ACTIVE" })
    .populate("userId", "fullName email role status collegeId departmentId")
    .lean();
  const students = await StudentProfile.find({ collegeId: institutionId }).lean();
  const studentMap = new Map<number, any>();
  for (const s of students) studentMap.set(s.userId, s);
  const result: UserWithCollegeResponse[] = [];
  for (const item of memberships as any[]) {
    const user = item.userId;
    if (!user || !STAFF_ROLES.includes(user.role as any)) continue;
    const student = studentMap.get(user._id);
    result.push({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      studentId: student?.studentId ?? null,
      college: student?.college ?? null,
      branch: student?.branch ?? null,
      graduationYear: student?.graduationYear ?? null,
      createdAt: user.createdAt,
    });
  }
  return result;
}

export async function listInstitutionMemberships(institutionId: number, actor: AdminActor): Promise<MembershipResponse[]> {
  if (actor.role !== "SUPER_ADMIN") {
    throw AppError.forbidden("Only platform administrators can list memberships.");
  }
  const institution = await Institution.findById(institutionId);
  if (!institution) throw AppError.notFound("Institution not found.");
  const memberships = await InstitutionMembership.find({ institutionId }).sort({ createdAt: -1 }).lean();
  const userIds = memberships.map((m) => m.userId);
  const users = userIds.length > 0 ? await User.find({ _id: { $in: userIds } }).lean() : [];
  const userMap = new Map(users.map((u) => [u._id, u]));

  const result: MembershipResponse[] = [];
  for (const m of memberships) {
    const user = userMap.get(m.userId);
    result.push({
      id: m._id,
      userId: m.userId,
      fullName: user?.fullName ?? "Unknown",
      email: user?.email ?? "",
      designation: m.designation,
      scopeType: m.scopeType,
      scopeId: m.scopeId ?? null,
      scopeLabel: await scopeLabel(institutionId, m.scopeType as any, m.scopeId),
      status: m.status,
      acceptedAt: m.acceptedAt ?? null,
      createdAt: m.createdAt,
    });
  }
  return result;
}

export async function updateInstitutionMembershipStatus(
  institutionId: number,
  membershipId: number,
  status: "ACTIVE" | "INACTIVE",
  actor: AdminActor,
): Promise<MembershipResponse> {
  if (actor.role !== "SUPER_ADMIN") {
    throw AppError.forbidden("Only platform administrators can change membership status.");
  }
  const membership = await InstitutionMembership.findOne({ _id: membershipId, institutionId });
  if (!membership) throw AppError.notFound("Membership not found.");
  const user = await User.findById(membership.userId);
  if (!user) throw AppError.notFound("User not found.");

  if (membership.designation !== "COLLEGE_ADMIN") {
    throw AppError.forbidden("Platform administrators can manage only college administrator memberships");
  }

  if (membership.status === "ACTIVE" && status !== "ACTIVE") {
    const activeCount = await InstitutionMembership.countDocuments({
      institutionId,
      designation: "COLLEGE_ADMIN",
      status: "ACTIVE",
    });
    if (activeCount <= 1) {
      throw AppError.conflict("The institution must keep at least one active college administrator.");
    }
  }

  membership.status = status;
  await membership.save();
  await recordInstitutionEvent({
    action: "MEMBERSHIP_UPDATE",
    targetType: "MEMBERSHIP",
    targetId: String(membership._id),
    institutionId,
    details: `platformAdminStatus=${status}`,
  });

  return {
    id: membership._id,
    userId: user._id,
    fullName: user.fullName,
    email: user.email,
    designation: membership.designation,
    scopeType: membership.scopeType,
    scopeId: membership.scopeId ?? null,
    scopeLabel: await scopeLabel(institutionId, membership.scopeType as any, membership.scopeId),
    status: membership.status,
    acceptedAt: membership.acceptedAt ?? null,
    createdAt: membership.createdAt,
  };
}

export async function inviteAdministrator(institutionId: number, input: { email: string; designation: string; scopeType: string; scopeId?: number | null }, actor: AdminActor): Promise<UserWithCollegeResponse> {
  if (actor.role !== "SUPER_ADMIN") {
    throw AppError.forbidden("Only platform administrators can invite administrators.");
  }
  const institution = await Institution.findById(institutionId);
  if (!institution) throw AppError.notFound("Institution not found.");
  const user = await User.findOne({ email: input.email.toLowerCase() });
  if (!user) throw AppError.notFound("User not found.");
  if (!STAFF_ROLES.includes(user.role as any)) throw AppError.badRequest("Only staff roles can be invited as administrators.");
  const scopeType = input.scopeType;
  const scopeId = input.scopeId ?? null;
  const membership = await InstitutionMembership.findOne({ institutionId, userId: user._id });
  if (membership) {
    if (membership.status === "INVITED" as any) {
      membership.status = "ACTIVE" as any;
      membership.designation = input.designation as any;
      membership.scopeType = scopeType as any;
      membership.scopeId = scopeId;
      await membership.save();
    } else if (membership.status === "ACTIVE") {
      throw AppError.conflict("This user is already an active member of the institution.");
    }
    return { id: user._id, fullName: user.fullName, email: user.email, studentId: null, college: null, branch: null, graduationYear: null, createdAt: user.createdAt };
  }
  const [created] = await (InstitutionMembership.create as any)([{
    _id: await getNextSequence("institution_memberships"),
    institutionId,
    userId: user._id,
    designation: input.designation,
    scopeType,
    scopeId,
    status: "ACTIVE",
  }]);
  await recordInstitutionEvent({ action: "MEMBERSHIP_CREATE", targetType: "MEMBERSHIP", targetId: String(created._id), institutionId, details: `designation=${input.designation}` });
  return { id: user._id, fullName: user.fullName, email: user.email, studentId: null, college: null, branch: null, graduationYear: null, createdAt: user.createdAt };
}

export async function updateAdministratorStatus(institutionId: number, membershipId: number, status: "ACTIVE" | "INACTIVE", actor: AdminActor): Promise<UserWithCollegeResponse> {
  if (actor.role !== "SUPER_ADMIN") {
    throw AppError.forbidden("Only platform administrators can change administrator status.");
  }
  const membership = await InstitutionMembership.findOne({ _id: membershipId, institutionId });
  if (!membership) throw AppError.notFound("Membership not found.");
  const user = await User.findById(membership.userId);
  if (!user) throw AppError.notFound("User not found.");
  if (membership.designation === "COLLEGE_ADMIN" && membership.status === "ACTIVE" && status !== "ACTIVE") {
    const activeCount = await InstitutionMembership.countDocuments({ institutionId, designation: "COLLEGE_ADMIN", status: "ACTIVE" });
    if (activeCount <= 1) {
      throw AppError.conflict("The institution must keep at least one active college administrator.");
    }
  }
  membership.status = status;
  await membership.save();
  await recordInstitutionEvent({ action: "MEMBERSHIP_UPDATE", targetType: "MEMBERSHIP", targetId: String(membership._id), institutionId, details: `status=${status}` });
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    studentId: null,
    college: null,
    branch: null,
    graduationYear: null,
    createdAt: user.createdAt,
  };
}

export async function getStudentCount(institutionId: number): Promise<number> {
  const institution = await Institution.findById(institutionId);
  if (!institution) throw AppError.notFound("Institution not found.");
  return await StudentProfile.countDocuments({ collegeId: institutionId });
}

export async function listStudentsForAdmin(page = 0, size = 10): Promise<UserWithCollegeResponse[]> {
  const skip = page * size;
  const students = await StudentProfile.find()
    .select("userId fullName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(size)
    .lean();
  const ids = students.map((s) => s.userId);
  const users = ids.length > 0 ? await User.find({ _id: { $in: ids } }).lean() : [];
  const userMap = new Map<number, any>();
  for (const u of users) userMap.set(u._id, u);
  const studentMap = new Map<number, any>();
  for (const s of students) studentMap.set(s.userId, s);
  return users
    .filter((u) => u && u._id && u.role === "STUDENT")
    .map((u) => {
      const student = studentMap.get(u._id);
      return {
        id: u._id,
        fullName: u.fullName,
        email: u.email,
        studentId: student?.studentId ?? null,
        college: student?.college ?? null,
        branch: student?.branch ?? null,
        graduationYear: student?.graduationYear ?? null,
        createdAt: u.createdAt,
      };
    });
}

export async function getStats(): Promise<{ institutionCount: number; studentCount: number; staffCount: number }> {
  const [institutions, students, staff] = await Promise.all([
    Institution.countDocuments(),
    StudentProfile.countDocuments(),
    User.countDocuments({ role: { $in: STAFF_ROLES } }),
  ]);
  return { institutionCount: institutions, studentCount: students, staffCount: staff };
}

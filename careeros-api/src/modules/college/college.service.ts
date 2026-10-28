import { AppError } from "../../lib/errors.js";
import { recordInstitutionEvent } from "../../lib/audit.js";
import { getNextSequence } from "../../models/Counter.js";
import { Institution } from "../../models/Institution.js";
import { InstitutionMembership, type MembershipStatus, type ScopeType, type StaffDesignation } from "../../models/InstitutionMembership.js";
import { User } from "../../models/User.js";
import { scopeLabel, validateInvitationScope } from "../invitations/invitation.service.js";

export interface InstitutionInput { code?: string; name: string; timezone?: string | null; contactEmail?: string | null; status?: "ACTIVE" | "INACTIVE"; }
const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;
function optionalText(value?: string | null, max = 160) { const clean = value?.trim() ?? ""; if (!clean) return null; if (clean.length > max) throw AppError.badRequest(`Value must be at most ${max} characters`); return clean; }
function emailOrNull(value?: string | null) { const clean = value?.trim().toLowerCase() ?? ""; if (!clean) return null; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean) || clean.length > 190) throw AppError.badRequest("A valid email address is required"); return clean; }

export async function createInstitution(input: InstitutionInput) {
  const code = input.code?.trim() ?? "";
  if (!CODE.test(code)) throw AppError.badRequest("Institution code must contain 2–40 letters, numbers, dots, underscores or hyphens");
  const exists = await Institution.findOne({ code }).collation({ locale: "en", strength: 2 }).lean();
  if (exists) throw AppError.conflict("An institution with this code already exists");
  const name = input.name.trim(); if (!name || name.length > 160) throw AppError.badRequest("Institution name is required and must be at most 160 characters");
  const [institution] = await Institution.create([{
    _id: await getNextSequence("institutions"), code: code.toUpperCase(), name,
    timezone: optionalText(input.timezone, 60), contactEmail: emailOrNull(input.contactEmail), status: input.status ?? "ACTIVE",
  }]);
  await recordInstitutionEvent({ action: "INSTITUTION_CREATE", targetType: "INSTITUTION", targetId: String(institution._id), institutionId: institution._id, details: `code=${institution.code}` });
  return institutionResponse(institution);
}

function institutionResponse(institution: { _id: number; code: string; name: string; status: string; timezone?: string | null; contactEmail?: string | null; createdAt: Date; updatedAt: Date }) {
  return { id: institution._id, code: institution.code, name: institution.name, status: institution.status, timezone: institution.timezone ?? null, contactEmail: institution.contactEmail ?? null, createdAt: institution.createdAt, updatedAt: institution.updatedAt };
}

export async function listInstitutions() {
  return (await Institution.find().sort({ name: 1, _id: 1 }).lean()).map(institutionResponse);
}

export async function updateInstitution(institutionId: number, input: InstitutionInput, platformAdmin: boolean) {
  const institution = await Institution.findById(institutionId);
  if (!institution) throw AppError.notFound("Institution not found");
  const name = input.name.trim(); if (!name || name.length > 160) throw AppError.badRequest("Institution name is required and must be at most 160 characters");
  institution.name = name;
  institution.timezone = optionalText(input.timezone, 60);
  institution.contactEmail = emailOrNull(input.contactEmail);
  if (platformAdmin && input.status) institution.status = input.status;
  await institution.save();
  await recordInstitutionEvent({ action: "INSTITUTION_UPDATE", targetType: "INSTITUTION", targetId: String(institution._id), institutionId: institution._id, details: `name=${institution.name}` });
  return institutionResponse(institution);
}

export async function setInstitutionStatus(institutionId: number, status: "ACTIVE" | "INACTIVE") {
  const institution = await Institution.findById(institutionId);
  if (!institution) throw AppError.notFound("Institution not found");
  institution.status = status; await institution.save();
  await recordInstitutionEvent({ action: "INSTITUTION_STATUS_CHANGE", targetType: "INSTITUTION", targetId: String(institutionId), institutionId, details: `status=${status}` });
  return institutionResponse(institution);
}

function permissions(designation: StaffDesignation) {
  const canExport = designation !== "FACULTY"; const canManageStaff = designation === "COLLEGE_ADMIN";
  const canImport = ["COLLEGE_ADMIN", "TPO", "HOD"].includes(designation);
  const permissions = ["VIEW_STUDENTS", "VIEW_DASHBOARD", "VIEW_IMPROVEMENT_PLANS"];
  if (canExport) permissions.push("EXPORT_STUDENTS", "GENERATE_REPORTS", "VIEW_REPORTS");
  if (canImport) permissions.push("IMPORT_STUDENTS");
  if (canManageStaff) permissions.push("MANAGE_STRUCTURE", "MANAGE_STAFF", "MANAGE_STUDENTS");
  if (designation !== "FACULTY") permissions.push("MANAGE_STUDENTS", "VIEW_PLACEMENT", "VIEW_PLACEMENT_REPORTS");
  if (["COLLEGE_ADMIN", "TPO"].includes(designation)) permissions.push("MANAGE_COMPANIES", "MANAGE_JOBS", "VIEW_COMPANY_CONTACTS", "MANAGE_DRIVES", "MANAGE_APPLICATIONS");
  return [...new Set(permissions)];
}

export async function collegeMe(membership: { _id: number; userId: number; institutionId: number; designation: StaffDesignation; scopeType: ScopeType; scopeId?: number | null }, institution: { name: string }, user: { email: string; fullName: string }) {
  return {
    userId: membership.userId, email: user.email, fullName: user.fullName,
    institutionId: membership.institutionId, institutionName: institution.name,
    designation: membership.designation, scopeType: membership.scopeType,
    scopeId: membership.scopeId ?? null,
    scopeLabel: await scopeLabel(membership.institutionId, membership.scopeType, membership.scopeId),
    permissions: permissions(membership.designation),
  };
}

async function membershipResponse(membership: { _id: number; userId: number; institutionId: number; designation: StaffDesignation; status: MembershipStatus; scopeType: ScopeType; scopeId?: number | null; acceptedAt?: Date | null; createdAt: Date }) {
  const user = await User.findById(membership.userId).select("fullName email").lean();
  if (!user) return [];
  return [{
    id: membership._id, userId: membership.userId, fullName: user.fullName, email: user.email,
    designation: membership.designation, scopeType: membership.scopeType, scopeId: membership.scopeId ?? null,
    scopeLabel: await scopeLabel(membership.institutionId, membership.scopeType, membership.scopeId),
    status: membership.status, acceptedAt: membership.acceptedAt ?? null, createdAt: membership.createdAt,
  }];
}

export async function listCollegeMembers(institutionId: number) {
  const rows = await InstitutionMembership.find({ institutionId }).sort({ createdAt: -1 }).lean();
  return (await Promise.all(rows.map(membershipResponse))).flat();
}

export async function listAdminMemberships(institutionId: number) {
  if (!await Institution.exists({ _id: institutionId })) throw AppError.notFound("Institution not found");
  const rows = await InstitutionMembership.find({ institutionId, designation: "COLLEGE_ADMIN" }).sort({ createdAt: -1 }).lean();
  return (await Promise.all(rows.map(membershipResponse))).flat();
}

export async function updateMembershipStatus(institutionId: number, membershipId: number, status: MembershipStatus, adminOnly: boolean, actorUserId?: number) {
  const membership = await InstitutionMembership.findOne({ _id: membershipId, institutionId });
  if (!membership) throw AppError.notFound("Membership not found");
  if (adminOnly && membership.designation !== "COLLEGE_ADMIN") throw AppError.forbidden("Platform administrators can manage only college administrator memberships");
  if (membership.designation === "COLLEGE_ADMIN" && membership.status === "ACTIVE" && status !== "ACTIVE" &&
      await InstitutionMembership.countDocuments({ institutionId, designation: "COLLEGE_ADMIN", status: "ACTIVE" }) <= 1) {
    throw AppError.conflict("The institution must keep at least one active college administrator");
  }
  membership.status = status; await membership.save();
  await recordInstitutionEvent({ actorUserId, actorRole: adminOnly ? "ADMIN" : "PROFESSOR", action: "MEMBERSHIP_UPDATE", targetType: "MEMBERSHIP", targetId: String(membershipId), institutionId, details: `status=${status}` });
  return (await membershipResponse(membership))[0];
}

export interface MembershipUpdateInput { designation?: StaffDesignation; scopeType?: ScopeType; scopeId?: number | null; status?: MembershipStatus; }
export async function updateCollegeMembership(institutionId: number, actorUserId: number, membershipId: number, input: MembershipUpdateInput) {
  const membership = await InstitutionMembership.findOne({ _id: membershipId, institutionId });
  if (!membership) throw AppError.notFound("Membership not found");
  const designation = input.designation ?? membership.designation;
  const scopeType = input.scopeType ?? membership.scopeType;
  const scopeId = input.scopeType == null ? membership.scopeId : input.scopeId ?? null;
  const status = input.status ?? membership.status;
  await validateInvitationScope(institutionId, designation, scopeType, scopeId);
  if (membership.designation === "COLLEGE_ADMIN" && membership.status === "ACTIVE" && (designation !== "COLLEGE_ADMIN" || status !== "ACTIVE") &&
      await InstitutionMembership.countDocuments({ institutionId, designation: "COLLEGE_ADMIN", status: "ACTIVE" }) <= 1) {
    throw AppError.conflict("The institution must keep at least one active college administrator");
  }
  membership.designation = designation; membership.scopeType = scopeType; membership.scopeId = scopeId; membership.status = status;
  await membership.save();
  await recordInstitutionEvent({ actorUserId, actorRole: "PROFESSOR", action: "MEMBERSHIP_UPDATE", targetType: "MEMBERSHIP", targetId: String(membershipId), institutionId, details: `designation=${designation},status=${status},scope=${scopeType}` });
  return (await membershipResponse(membership.toObject()))[0];
}

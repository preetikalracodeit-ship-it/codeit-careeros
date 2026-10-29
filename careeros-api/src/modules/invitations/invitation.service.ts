import { randomBytes } from "node:crypto";
import type { ClientSession } from "mongoose";
import { env } from "../../config/env.js";
import { recordInstitutionEvent } from "../../lib/audit.js";
import { withTransaction } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { sha256 } from "../../lib/tokenHash.js";
import { getNextSequence } from "../../models/Counter.js";
import { Batch } from "../../models/Batch.js";
import { ConsentRecord, EVIDENCE_AUTHENTICATED_CONSENT, EVIDENCE_REGISTRATION_CHECKBOX } from "../../models/ConsentRecord.js";
import { Department } from "../../models/Department.js";
import { Institution } from "../../models/Institution.js";
import { InstitutionMembership, type ScopeType, type StaffDesignation } from "../../models/InstitutionMembership.js";
import { Program } from "../../models/Program.js";
import { Section } from "../../models/Section.js";
import { StaffInvitation } from "../../models/StaffInvitation.js";
import { User, type UserDoc } from "../../models/User.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { issueSessionForUser, type AuthResponse } from "../auth/auth.service.js";
import type { InvitationAcceptInput, InvitationCreateInput } from "./invitation.schemas.js";

function invitationStatus(invitation: { acceptedAt?: Date | null; revokedAt?: Date | null; expiresAt: Date }) {
  if (invitation.acceptedAt) return "ACCEPTED";
  if (invitation.revokedAt) return "REVOKED";
  if (invitation.expiresAt.getTime() < Date.now()) return "EXPIRED";
  return "VALID";
}

function maskEmail(email: string) {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

async function byRawToken(rawToken: string, session?: ClientSession) {
  if (!rawToken || rawToken.length > 200) throw AppError.notFound("Invitation not found");
  const query = StaffInvitation.findOne({ tokenHash: sha256(rawToken) });
  if (session) query.session(session);
  const invitation = await query.lean();
  if (!invitation) throw AppError.notFound("Invitation not found");
  return invitation;
}

export async function scopeLabel(institutionId: number, scopeType: ScopeType, scopeId?: number | null) {
  if (scopeType === "INSTITUTION") return "Whole institution";
  if (scopeId == null) return "—";
  if (scopeType === "DEPARTMENT") return (await Department.findOne({ _id: scopeId, institutionId }).select("name").lean())?.name ?? `Department #${scopeId}`;
  if (scopeType === "PROGRAM") return (await Program.findOne({ _id: scopeId, institutionId }).select("name").lean())?.name ?? `Program #${scopeId}`;
  if (scopeType === "BATCH") {
    const batch = await Batch.findById(scopeId).select("label programId").lean();
    if (batch && await Program.exists({ _id: batch.programId, institutionId })) return batch.label;
    return `Batch #${scopeId}`;
  }
  const section = await Section.findById(scopeId).select("name batchId").lean();
  if (section) {
    const batch = await Batch.findById(section.batchId).select("programId").lean();
    if (batch && await Program.exists({ _id: batch.programId, institutionId })) return section.name;
  }
  return `Section #${scopeId}`;
}

export async function publicInvitation(rawToken: string) {
  const invitation = await byRawToken(rawToken);
  const institution = await Institution.findById(invitation.institutionId).select("name").lean();
  if (!institution) throw AppError.notFound("Invitation not found");
  return {
    institutionName: institution.name,
    maskedEmail: maskEmail(invitation.email),
    designation: invitation.designation,
    scopeType: invitation.scopeType,
    scopeLabel: await scopeLabel(invitation.institutionId, invitation.scopeType, invitation.scopeId),
    expiresAt: invitation.expiresAt,
    status: invitationStatus(invitation),
  };
}

export async function validateInvitationScope(institutionId: number, designation: StaffDesignation, scopeType: ScopeType, scopeId?: number | null) {
  if ((designation === "COLLEGE_ADMIN" || designation === "TPO") && scopeType !== "INSTITUTION") throw AppError.badRequest(`${designation} must have institution-wide scope`);
  if (designation === "HOD" && scopeType !== "DEPARTMENT") throw AppError.badRequest("HOD must have department scope");
  if (designation === "FACULTY" && scopeType !== "SECTION") throw AppError.badRequest("Faculty must be assigned to a section");
  if (scopeType === "INSTITUTION") {
    if (scopeId != null) throw AppError.badRequest("Institution-wide scope must not include a scope id");
    return;
  }
  if (scopeId == null) throw AppError.badRequest(`A scope id is required for ${scopeType}`);
  let exists = false;
  if (scopeType === "DEPARTMENT") exists = Boolean(await Department.exists({ _id: scopeId, institutionId }));
  if (scopeType === "PROGRAM") exists = Boolean(await Program.exists({ _id: scopeId, institutionId }));
  if (scopeType === "BATCH") {
    const batch = await Batch.findById(scopeId).select("programId").lean();
    exists = Boolean(batch && await Program.exists({ _id: batch.programId, institutionId }));
  }
  if (scopeType === "SECTION") {
    const section = await Section.findById(scopeId).select("batchId").lean();
    const batch = section ? await Batch.findById(section.batchId).select("programId").lean() : null;
    exists = Boolean(batch && await Program.exists({ _id: batch.programId, institutionId }));
  }
  if (!exists) throw AppError.notFound(`Scope not found in this institution`);
}

async function ensureInviteEligibleAccount(email: string) {
  const user = await User.findOne({ emailLower: email }).lean();
  if (!user) return;
  if (user.role === "SUPER_ADMIN") throw AppError.conflict("This account cannot be invited as college staff");
  if (await InstitutionMembership.exists({ userId: user._id, status: "ACTIVE" })) throw AppError.conflict("This account already has an active institution membership");
}

async function issueInvitation(institutionId: number, emailInput: string, designation: StaffDesignation, scopeType: ScopeType, scopeId: number | null, actorUserId: number | null) {
  const email = emailInput.trim().toLowerCase();
  const institution = await Institution.findById(institutionId).lean();
  if (!institution) throw AppError.notFound("Institution not found");
  await validateInvitationScope(institutionId, designation, scopeType, scopeId);
  const outstanding = await StaffInvitation.find({ institutionId, acceptedAt: null, revokedAt: null }).select("email").lean();
  if (outstanding.some((row) => row.email.toLowerCase() === email)) {
    throw AppError.conflict("An active invitation already exists for this email");
  }
  await ensureInviteEligibleAccount(email);
  const token = randomBytes(32).toString("base64url");
  const invitationId = await getNextSequence("staff_invitations");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const [invitation] = await StaffInvitation.create([{
    _id: invitationId, institutionId, email, designation, scopeType, scopeId,
    tokenHash: sha256(token), expiresAt, acceptedAt: null, revokedAt: null, createdBy: actorUserId,
  }]);
  await recordInstitutionEvent({
    actorUserId, actorRole: actorUserId == null ? "SUPER_ADMIN" : "COLLEGE_STAFF",
    action: "STAFF_INVITATION_CREATE", targetType: "STAFF_INVITATION", targetId: String(invitation._id),
    institutionId, scopeDescription: `${scopeType}:${scopeId ?? institutionId}`,
    details: `designation=${designation},scope=${scopeType}`,
  });
  const scope = await scopeLabel(institutionId, scopeType, scopeId);
  return {
    invitation: {
      id: invitation._id, email, designation, scopeType, scopeId, scopeLabel: scope,
      status: invitationStatus(invitation), expiresAt, acceptedAt: null, revokedAt: null, createdAt: invitation.createdAt,
    },
    activationPath: `/accept-invitation?token=${token}`,
    emailDelivered: false,
    deliveryMessage: "Email delivery is not configured. Share the one-time activation link directly with the invitee.",
  };
}

export async function createCollegeInvitation(institutionId: number, actorUserId: number, input: InvitationCreateInput) {
  return issueInvitation(institutionId, input.email, input.designation, input.scopeType, input.scopeId ?? null, actorUserId);
}

export async function createBootstrapInvitation(institutionId: number, input: InvitationCreateInput) {
  if (input.designation !== "COLLEGE_ADMIN" || input.scopeType !== "INSTITUTION" || input.scopeId != null) {
    throw AppError.badRequest("The bootstrap invitation must be an institution-wide college administrator");
  }
  if (await InstitutionMembership.countDocuments({ institutionId, designation: "COLLEGE_ADMIN", status: "ACTIVE" }) > 0) {
    throw AppError.conflict("This institution already has a college administrator");
  }
  return issueInvitation(institutionId, input.email, input.designation, input.scopeType, null, null);
}

function invitationResponse(invitation: { _id: number; email: string; designation: StaffDesignation; scopeType: ScopeType; scopeId?: number | null; expiresAt: Date; acceptedAt?: Date | null; revokedAt?: Date | null; createdAt: Date }, label: string) {
  return { id: invitation._id, email: invitation.email, designation: invitation.designation, scopeType: invitation.scopeType, scopeId: invitation.scopeId ?? null, scopeLabel: label, status: invitationStatus(invitation), expiresAt: invitation.expiresAt, acceptedAt: invitation.acceptedAt ?? null, revokedAt: invitation.revokedAt ?? null, createdAt: invitation.createdAt };
}

export async function listCollegeInvitations(institutionId: number) {
  const rows = await StaffInvitation.find({ institutionId }).sort({ createdAt: -1 }).lean();
  return Promise.all(rows.map(async (row) => invitationResponse(row, await scopeLabel(institutionId, row.scopeType, row.scopeId))));
}

export async function revokeCollegeInvitation(institutionId: number, actorUserId: number, invitationId: number) {
  const invitation = await StaffInvitation.findOne({ _id: invitationId, institutionId }).lean();
  if (!invitation) throw AppError.notFound("Invitation not found");
  if (invitation.acceptedAt) throw AppError.conflict("This invitation has already been accepted");
  if (!invitation.revokedAt) {
    const revokedAt = new Date();
    await StaffInvitation.updateOne({ _id: invitationId, institutionId, acceptedAt: null }, { $set: { revokedAt } });
    await recordInstitutionEvent({ actorUserId, actorRole: "COLLEGE_STAFF", action: "STAFF_INVITATION_REVOKE", targetType: "STAFF_INVITATION", targetId: String(invitationId), institutionId, details: "revoked" });
  }
}

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000;
}

function requireStrongPassword(password: string) {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw AppError.badRequest("Password must be at least 8 characters and contain letters and digits");
  }
}

async function recordConsent(userId: number, method: "PASSWORD_REGISTRATION" | "RECONSENT", evidence: string, session: ClientSession) {
  const existing = await ConsentRecord.findOne({ userId, consentType: "TERMS_AND_PRIVACY", policyVersion: env.PRIVACY_POLICY_VERSION }).session(session).lean();
  if (existing) return;
  await ConsentRecord.create([{
    _id: await getNextSequence("consent_records", session), userId, consentType: "TERMS_AND_PRIVACY",
    policyVersion: env.PRIVACY_POLICY_VERSION, method, evidence, acceptedAt: new Date(),
  }], { session });
}

export async function acceptInvitation(rawToken: string, input: InvitationAcceptInput): Promise<AuthResponse> {
  let result: { auth: AuthResponse; institutionId: number; invitationId: number; designation: string; isNewAccount: boolean };
  try {
    result = await withTransaction(async (session) => {
      const invitation = await byRawToken(rawToken, session);
      if (invitation.acceptedAt) throw AppError.conflict("This invitation has already been used");
      if (invitation.revokedAt) throw AppError.badRequest("This invitation is no longer valid");
      if (invitation.expiresAt.getTime() <= Date.now()) throw AppError.badRequest("This invitation has expired");
      const institution = await Institution.findById(invitation.institutionId).session(session).lean();
      if (!institution) throw AppError.notFound("Institution not found");
      if (institution.status !== "ACTIVE") throw AppError.forbidden("The institution is not active");

      const emailLower = invitation.email.trim().toLowerCase();
      let user: UserDoc | null = await User.findOne({ emailLower }).session(session).lean();
      const isNewAccount = !user;
      if (user) {
        if (user.status !== "ACTIVE") throw AppError.forbidden("This account is not active");
        if (user.role === "SUPER_ADMIN") throw AppError.forbidden("This account cannot be linked to an institution");
        if (!input.password || !(await verifyPassword(input.password, user.passwordHash))) throw AppError.badRequest("Invalid invitation credentials");
        const currentConsent = await ConsentRecord.exists({ userId: user._id, consentType: "TERMS_AND_PRIVACY", policyVersion: env.PRIVACY_POLICY_VERSION }).session(session);
        if (!currentConsent && input.termsAccepted !== true) throw AppError.badRequest("You must accept the current Terms of Service and Privacy Policy");
        if (!currentConsent) await recordConsent(user._id, "RECONSENT", EVIDENCE_AUTHENTICATED_CONSENT, session);
        if (user.role !== invitation.designation) {
          await User.updateOne({ _id: user._id }, { $set: { role: invitation.designation } }, { session });
          user = { ...user, role: invitation.designation };
        }
      } else {
        if (input.termsAccepted !== true) throw AppError.badRequest("You must accept the Terms of Service and Privacy Policy to activate the account");
        const fullName = input.fullName?.trim();
        if (!fullName) throw AppError.badRequest("Full name is required");
        if (fullName.length > 120) throw AppError.badRequest("Full name must be at most 120 characters");
        requireStrongPassword(input.password);
        const userId = await getNextSequence("users", session);
        const [created] = await User.create([{
          _id: userId, email: emailLower, emailLower, passwordHash: await hashPassword(input.password),
          fullName, role: invitation.designation, status: "ACTIVE",
        }], { session });
        user = created.toObject();
        await recordConsent(userId, "PASSWORD_REGISTRATION", EVIDENCE_REGISTRATION_CHECKBOX, session);
      }

      if (await InstitutionMembership.exists({ userId: user._id, status: "ACTIVE" }).session(session)) {
        throw AppError.conflict("This account already has an active institution membership");
      }
      const priorMembership = await InstitutionMembership.findOne({ userId: user._id, institutionId: institution._id }).session(session).lean();
      const acceptedAt = new Date();
      if (priorMembership) {
        await InstitutionMembership.updateOne({ _id: priorMembership._id }, { $set: {
          designation: invitation.designation, scopeType: invitation.scopeType, scopeId: invitation.scopeId ?? null,
          status: "ACTIVE", acceptedAt,
        } }, { session });
      } else {
        await InstitutionMembership.create([{
          _id: await getNextSequence("institution_memberships", session), userId: user._id,
          institutionId: institution._id, designation: invitation.designation,
          scopeType: invitation.scopeType, scopeId: invitation.scopeId ?? null, status: "ACTIVE", acceptedAt,
        }], { session });
      }
      const marked = await StaffInvitation.updateOne(
        { _id: invitation._id, acceptedAt: null, revokedAt: null, expiresAt: { $gt: acceptedAt } },
        { $set: { acceptedAt } }, { session },
      );
      if (marked.modifiedCount !== 1) throw AppError.conflict("This invitation is no longer available");
      const auth = await issueSessionForUser(user._id, session);
      await recordInstitutionEvent({
        action: "STAFF_INVITATION_ACCEPT", targetType: "STAFF_INVITATION", targetId: String(invitation._id),
        institutionId: institution._id, details: `newAccount=${isNewAccount},designation=${invitation.designation}`, session,
      });
      return { auth, institutionId: institution._id, invitationId: invitation._id, designation: invitation.designation, isNewAccount };
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw AppError.conflict("This account or invitation has already been used");
    throw error;
  }
  return result.auth;
}

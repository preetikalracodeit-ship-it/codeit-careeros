import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import { env } from "../../config/env.js";
import { withTransaction } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { sha256 } from "../../lib/tokenHash.js";
import { accessExpiresInSeconds, signAccessToken } from "../../lib/jwt.js";
import { logger } from "../../lib/logger.js";
import { getNextSequence } from "../../models/Counter.js";
import { User, type UserDoc } from "../../models/User.js";
import { RefreshToken } from "../../models/RefreshToken.js";
import {
  ConsentRecord,
  EVIDENCE_AUTHENTICATED_CONSENT,
  EVIDENCE_GOOGLE_SIGNUP_BUTTON,
  EVIDENCE_REGISTRATION_CHECKBOX,
  type ConsentMethod,
} from "../../models/ConsentRecord.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { toUserResponse, type UserResponse } from "./user.mapper.js";
import type { GoogleInput, LoginInput, RegisterInput } from "./auth.schemas.js";
import { verifyGoogleIdToken } from "./google.js";

const DEFAULT_CONSENT_TYPE = "TERMS_AND_PRIVACY" as const;

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserResponse;
  consentRequired: boolean;
  consentPolicyVersion: string;
}

export interface ConsentStatusResponse {
  currentPolicyVersion: string;
  consentCurrent: boolean;
  acceptedPolicyVersion?: string | null;
  acceptedAt?: string | null;
  method?: string | null;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function normalizeEmail(value: string): string {
  return value.toLowerCase().trim();
}

function generateStudentId(userId: number): string {
  return `STU${String(userId).padStart(6, "0")}`;
}

function generateRefreshTokenRaw(): string {
  return `${randomUUID().replaceAll("-", "")}-${randomUUID().replaceAll("-", "")}`;
}

async function isConsentCurrent(userId: number, session?: ClientSession): Promise<boolean> {
  const query = ConsentRecord.exists({
    userId,
    consentType: DEFAULT_CONSENT_TYPE,
    policyVersion: env.PRIVACY_POLICY_VERSION,
  });
  if (session) {
    query.session(session);
  }
  return Boolean(await query);
}

async function recordCurrentPolicy(
  userId: number,
  method: ConsentMethod,
  evidence: string,
  session?: ClientSession,
) {
  const filter = {
    userId,
    consentType: DEFAULT_CONSENT_TYPE,
    policyVersion: env.PRIVACY_POLICY_VERSION,
  };

  const existingQuery = ConsentRecord.findOne(filter);
  if (session) {
    existingQuery.session(session);
  }
  const existing = await existingQuery.lean();
  if (existing) {
    return existing;
  }

  const id = await getNextSequence("consent_records", session);
  try {
    const [created] = await ConsentRecord.create(
      [
        {
          _id: id,
          userId,
          consentType: DEFAULT_CONSENT_TYPE,
          policyVersion: env.PRIVACY_POLICY_VERSION,
          method,
          evidence,
          acceptedAt: new Date(),
        },
      ],
      session ? { session } : {},
    );
    return created;
  } catch (error) {
    if (isDuplicateKey(error)) {
      const duplicateQuery = ConsentRecord.findOne(filter);
      if (session) {
        duplicateQuery.session(session);
      }
      const duplicate = await duplicateQuery.lean();
      if (duplicate) {
        return duplicate;
      }
    }
    throw error;
  }
}

async function issueNewRefreshToken(
  userId: number,
  session?: ClientSession,
): Promise<{ raw: string; id: number }> {
  const raw = generateRefreshTokenRaw();
  const id = await getNextSequence("refresh_tokens", session);
  await RefreshToken.create(
    [
      {
        _id: id,
        userId,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRATION_MS),
        revoked: false,
        replacedById: null,
      },
    ],
    session ? { session } : {},
  );
  return { raw, id };
}

async function issueTokens(user: UserDoc, session?: ClientSession): Promise<AuthResponse> {
  const accessToken = signAccessToken(user);
  const refresh = await issueNewRefreshToken(user._id, session);
  return {
    accessToken,
    refreshToken: refresh.raw,
    tokenType: "Bearer",
    expiresIn: accessExpiresInSeconds(),
    user: toUserResponse(user),
    consentRequired: !(await isConsentCurrent(user._id, session)),
    consentPolicyVersion: env.PRIVACY_POLICY_VERSION,
  };
}

async function revokeAllForUser(userId: number, session?: ClientSession): Promise<void> {
  const query = RefreshToken.updateMany({ userId, revoked: false }, { $set: { revoked: true } });
  if (session) {
    query.session(session);
  }
  await query;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const email = normalizeEmail(input.email);
  if (input.termsAccepted !== true) {
    throw AppError.badRequest(
      "You must accept the Terms of Service and Privacy Policy to create an account",
    );
  }
  if (await User.exists({ emailLower: email })) {
    throw AppError.conflict("An account with this email already exists");
  }

  try {
    return await withTransaction(async (session) => {
      const userId = await getNextSequence("users", session);
      const [user] = await User.create(
        [
          {
            _id: userId,
            email,
            emailLower: email,
            passwordHash: await hashPassword(input.password),
            fullName: input.fullName.trim(),
            role: "STUDENT",
            status: "ACTIVE",
          },
        ],
        { session },
      );

      const profileId = await getNextSequence("student_profiles", session);
      await StudentProfile.create(
        [
          {
            _id: profileId,
            userId: user._id,
            studentId: generateStudentId(user._id),
            fullName: user.fullName,
            mobile: input.mobile.trim(),
            semester: 1,
          },
        ],
        { session },
      );

      await recordCurrentPolicy(
        user._id,
        "PASSWORD_REGISTRATION",
        EVIDENCE_REGISTRATION_CHECKBOX,
        session,
      );

      logger.info({ userId: user._id }, "Registered student");
      return issueTokens(user, session);
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict("An account with this email already exists");
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const email = normalizeEmail(input.email);
  const user = await User.findOne({ emailLower: email }).lean();
  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Invalid email or password");
  }
  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) {
    throw AppError.unauthorized("Invalid email or password");
  }
  logger.info({ userId: user._id }, "Logged in user");
  return issueTokens(user);
}

function requireTerms(accepted: boolean | undefined): void {
  if (accepted !== true) {
    throw AppError.badRequest(
      "You must accept the Terms of Service and Privacy Policy to create an account",
    );
  }
}

function truncateName(value: string | undefined, max: number): string {
  if (!value) return "Student";
  const trimmed = value.trim();
  if (!trimmed) return "Student";
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

export async function googleLogin(input: GoogleInput): Promise<AuthResponse> {
  const googleUser = await verifyGoogleIdToken(input.idToken);
  const email = normalizeEmail(googleUser.email);
  const existing = await User.findOne({ emailLower: email }).lean();

  if (existing && existing.status !== "ACTIVE") {
    throw AppError.forbidden("Account is disabled");
  }

  if (!existing) {
    requireTerms(input.termsAccepted);
    return withTransaction(async (session) => {
      const userId = await getNextSequence("users", session);
      const [user] = await User.create(
        [
          {
            _id: userId,
            email,
            emailLower: email,
            passwordHash: await hashPassword(`${randomUUID()}-google-oauth`),
            fullName: truncateName(googleUser.fullName, 120),
            role: "STUDENT",
            status: "ACTIVE",
          },
        ],
        { session },
      );

      const profileId = await getNextSequence("student_profiles", session);
      await StudentProfile.create(
        [
          {
            _id: profileId,
            userId: user._id,
            studentId: generateStudentId(user._id),
            fullName: user.fullName,
            semester: 1,
            profilePhotoUrl: googleUser.pictureUrl ?? null,
          },
        ],
        { session },
      );

      await recordCurrentPolicy(
        user._id,
        "GOOGLE_REGISTRATION",
        EVIDENCE_GOOGLE_SIGNUP_BUTTON,
        session,
      );

      logger.info({ userId: user._id }, "Registered student via Google");
      return issueTokens(user, session);
    });
  }

  logger.info({ userId: existing._id }, "Logged in user via Google");
  return issueTokens(existing);
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  const tokenHash = sha256(refreshToken);
  const stored = await RefreshToken.findOne({ tokenHash }).lean();

  if (!stored) {
    throw AppError.unauthorized("Invalid refresh token");
  }
  if (stored.revoked) {
    await revokeAllForUser(stored.userId);
    throw AppError.unauthorized("Refresh token reuse detected. All sessions revoked.");
  }
  if (stored.expiresAt.getTime() <= Date.now()) {
    throw AppError.unauthorized("Refresh token has expired");
  }

  const user = await User.findById(stored.userId).lean();
  if (!user || user.status !== "ACTIVE") {
    await revokeAllForUser(stored.userId);
    throw AppError.unauthorized("Account is disabled");
  }

  return withTransaction(async (session) => {
    const replacement = await issueNewRefreshToken(user._id, session);
    const updated = await RefreshToken.updateOne(
      { _id: stored._id, revoked: false },
      { $set: { revoked: true, replacedById: replacement.id } },
      { session },
    );
    if (updated.modifiedCount !== 1) {
      throw AppError.unauthorized("Invalid refresh token");
    }
    return {
      accessToken: signAccessToken(user),
      refreshToken: replacement.raw,
      tokenType: "Bearer",
      expiresIn: accessExpiresInSeconds(),
      user: toUserResponse(user),
      consentRequired: !(await isConsentCurrent(user._id, session)),
      consentPolicyVersion: env.PRIVACY_POLICY_VERSION,
    };
  });
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }
  const stored = await RefreshToken.findOne({ tokenHash: sha256(refreshToken) }).lean();
  if (!stored) {
    throw AppError.unauthorized("Invalid refresh token");
  }
  await RefreshToken.updateOne({ _id: stored._id }, { $set: { revoked: true } });
  logger.info({ userId: stored.userId }, "Logged out user");
}

export async function me(userId: number): Promise<UserResponse> {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw AppError.notFound("User not found");
  }
  return toUserResponse(user);
}

export async function consentStatus(userId: number): Promise<ConsentStatusResponse> {
  const latest = await ConsentRecord.findOne({
    userId,
    consentType: DEFAULT_CONSENT_TYPE,
  })
    .sort({ acceptedAt: -1 })
    .lean();

  if (!latest) {
    return {
      currentPolicyVersion: env.PRIVACY_POLICY_VERSION,
      consentCurrent: false,
      acceptedPolicyVersion: null,
      acceptedAt: null,
      method: null,
    };
  }

  return {
    currentPolicyVersion: env.PRIVACY_POLICY_VERSION,
    consentCurrent: latest.policyVersion === env.PRIVACY_POLICY_VERSION,
    acceptedPolicyVersion: latest.policyVersion,
    acceptedAt: latest.acceptedAt.toISOString(),
    method: latest.method,
  };
}

export async function acceptConsent(
  userId: number,
  accepted: boolean | undefined,
): Promise<ConsentStatusResponse> {
  if (accepted !== true) {
    throw AppError.badRequest(
      "You must explicitly accept the Terms of Service and Privacy Policy",
    );
  }
  await recordCurrentPolicy(userId, "RECONSENT", EVIDENCE_AUTHENTICATED_CONSENT);
  return consentStatus(userId);
}

export function authConfig() {
  return {
    googleClientId: env.googleClientId,
    googleConfigured: env.googleClientId.length > 0,
  };
}

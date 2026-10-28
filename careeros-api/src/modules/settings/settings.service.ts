import { AppError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { RefreshToken } from "../../models/RefreshToken.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { User } from "../../models/User.js";
import { toStudentProfileResponse, toUserResponse } from "../auth/user.mapper.js";
import type { ChangePasswordInput } from "../auth/auth.schemas.js";

export async function getSettings(userId: number) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw AppError.notFound("User not found");
  }

  const profile = await StudentProfile.findOne({ userId }).lean();
  const now = new Date();
  const activeSessions = await RefreshToken.countDocuments({
    userId,
    revoked: false,
    expiresAt: { $gt: now },
  });

  return {
    account: toUserResponse(user),
    profile: profile ? toStudentProfileResponse(profile, user.email) : null,
    aiStatus: {
      configured: false,
      provider: null,
      model: null,
      offlineFallback: true,
      mode: "offline-smart",
    },
    activeSessions,
    aiConversations: 0,
    hasCv: false,
    hasLinkedIn: false,
    notificationsConnected: false,
  };
}

export async function changePassword(userId: number, input: ChangePasswordInput): Promise<void> {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw AppError.notFound("User not found");
  }
  const currentMatches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!currentMatches) {
    throw AppError.unauthorized("Current password is incorrect");
  }
  const sameAsCurrent = await verifyPassword(input.newPassword, user.passwordHash);
  if (sameAsCurrent) {
    throw AppError.badRequest("New password must be different from the current password");
  }

  await User.updateOne(
    { _id: userId },
    { $set: { passwordHash: await hashPassword(input.newPassword) } },
  );
  await RefreshToken.updateMany({ userId, revoked: false }, { $set: { revoked: true } });
}

export async function revokeAllSessions(userId: number): Promise<number> {
  const active = await RefreshToken.countDocuments({
    userId,
    revoked: false,
    expiresAt: { $gt: new Date() },
  });
  await RefreshToken.updateMany({ userId, revoked: false }, { $set: { revoked: true } });
  return active;
}

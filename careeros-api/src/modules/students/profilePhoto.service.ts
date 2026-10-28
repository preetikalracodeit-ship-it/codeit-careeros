import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import type { StudentProfileDoc } from "../../models/StudentProfile.js";
import { toStudentProfileResponse } from "../auth/user.mapper.js";

export const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const SAFE_KEY = /^[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp)$/i;
const photoDirectory = path.resolve(env.PROFILE_PHOTO_DIR);

function safePhotoPath(key: string): string {
  if (!SAFE_KEY.test(key) || path.basename(key) !== key) {
    throw AppError.notFound("Profile photo file not found in storage");
  }
  return path.join(photoDirectory, key);
}

function detectImageType(bytes: Buffer): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

function validateImage(file: Express.Multer.File): { extension: string; contentType: string } {
  if (file.size <= 0) throw AppError.badRequest("Please choose a photo to upload");
  if (file.size > MAX_PROFILE_PHOTO_BYTES) throw AppError.badRequest("Photo must be at most 2 MB");

  const extension = path.extname(file.originalname || "").slice(1).toLowerCase();
  const contentType = MIME_BY_EXTENSION[extension];
  if (!contentType) throw AppError.badRequest("Only JPG, PNG or WebP photos are accepted");
  if (file.mimetype && file.mimetype !== "application/octet-stream" && file.mimetype.toLowerCase() !== contentType) {
    throw AppError.badRequest("Only JPG, PNG or WebP photos are accepted");
  }

  const detected = detectImageType(file.buffer);
  const expected = contentType === "image/jpeg" ? "jpeg" : contentType.slice("image/".length);
  if (detected !== expected) throw AppError.badRequest("The uploaded file is not a valid JPG, PNG or WebP image");
  return { extension, contentType };
}

async function deletePhotoQuietly(key: string | null | undefined, keepKey?: string): Promise<void> {
  if (!key || key === keepKey || !SAFE_KEY.test(key) || path.basename(key) !== key) return;
  try {
    await unlink(path.join(photoDirectory, key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn({ error }, "Could not remove replaced profile photo");
    }
  }
}

export async function uploadCurrentProfilePhoto(userId: number, email: string, file?: Express.Multer.File) {
  if (!file) throw AppError.badRequest("Please choose a photo to upload");
  const { extension } = validateImage(file);
  const current = await StudentProfile.findOne({ userId }).select("profilePhotoUrl").lean();
  if (!current) throw AppError.notFound(`Student profile not found for user ${userId}`);

  const key = `${randomUUID()}.${extension}`;
  try {
    await mkdir(photoDirectory, { recursive: true });
    await writeFile(safePhotoPath(key), file.buffer, { flag: "wx", mode: 0o600 });
  } catch {
    throw AppError.conflict("Could not store the photo, please try again");
  }

  let profile: StudentProfileDoc | null;
  try {
    profile = await StudentProfile.findOneAndUpdate(
      { userId },
      { $set: { profilePhotoUrl: key } },
      { new: true, runValidators: true },
    ).lean() as StudentProfileDoc | null;
  } catch (error) {
    await deletePhotoQuietly(key);
    throw error;
  }
  if (!profile) {
    await deletePhotoQuietly(key);
    throw AppError.notFound(`Student profile not found for user ${userId}`);
  }

  await deletePhotoQuietly(current.profilePhotoUrl, key);
  logger.info({ userId, byteCount: file.size }, "Student uploaded profile photo");
  return toStudentProfileResponse(profile, email);
}

export async function downloadCurrentProfilePhoto(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).select("profilePhotoUrl").lean();
  if (!profile) throw AppError.notFound("Student profile not found");
  const key = profile.profilePhotoUrl;
  if (!key) throw AppError.notFound("No profile photo uploaded yet");
  const fullPath = safePhotoPath(key);
  try {
    const bytes = await readFile(fullPath);
    const extension = path.extname(key).slice(1).toLowerCase();
    const contentType = MIME_BY_EXTENSION[extension];
    if (!contentType) throw AppError.notFound("Profile photo file not found in storage");
    return { bytes, contentType };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw AppError.notFound("Profile photo file not found in storage");
    }
    throw AppError.conflict("Could not read the profile photo, please try again");
  }
}

export async function deleteCurrentProfilePhoto(userId: number, email: string) {
  const profile = await StudentProfile.findOne({ userId }).select("profilePhotoUrl").lean();
  if (!profile) throw AppError.notFound(`Student profile not found for user ${userId}`);
  const oldKey = profile.profilePhotoUrl;
  if (!oldKey) throw AppError.notFound("No profile photo uploaded yet");

  const updated = await StudentProfile.findOneAndUpdate(
    { userId },
    { $set: { profilePhotoUrl: null } },
    { new: true, runValidators: true },
  ).lean() as StudentProfileDoc | null;
  if (!updated) throw AppError.notFound(`Student profile not found for user ${userId}`);
  await deletePhotoQuietly(oldKey);
  logger.info({ userId }, "Student removed profile photo");
  return toStudentProfileResponse(updated, email);
}

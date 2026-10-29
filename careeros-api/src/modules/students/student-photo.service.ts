import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { getStudentProfile } from "./student.service.js";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MIME_TO_EXTENSION = new Map([
  ["image/jpeg", new Set(["jpg", "jpeg"])],
  ["image/png", new Set(["png"])],
  ["image/webp", new Set(["webp"])],
]);

function safeFilePath(storageKey: string) {
  const filename = path.basename(storageKey);
  const filePath = path.resolve(env.profilePhotoDir, filename);
  if (path.dirname(filePath) !== env.profilePhotoDir) {
    throw AppError.badRequest("Invalid profile photo key");
  }
  return filePath;
}

async function deleteFileQuietly(storageKey?: string | null) {
  if (!storageKey) return;
  try {
    await unlink(safeFilePath(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn({ err: error }, "Could not remove replaced student profile photo");
    }
  }
}

export function validateProfilePhoto(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).slice(1).toLowerCase();
  const extensions = MIME_TO_EXTENSION.get(file.mimetype.toLowerCase());
  if (!extensions || !extensions.has(extension)) {
    throw AppError.badRequest("Only JPG, PNG or WebP photos are accepted");
  }
  if (file.size === 0) throw AppError.badRequest("Please choose a photo to upload");
  if (file.size > MAX_FILE_SIZE) throw AppError.payloadTooLarge("Photo must be at most 2 MB");
  return { extension, contentType: file.mimetype.toLowerCase() };
}

export async function uploadStudentPhoto(userId: number, file: Express.Multer.File) {
  const { extension } = validateProfilePhoto(file);
  const profile = await StudentProfile.findOne({ userId });
  if (!profile) throw AppError.notFound("Student profile not found");

  await mkdir(env.profilePhotoDir, { recursive: true });
  const storageKey = `${randomUUID()}.${extension}`;
  const filePath = safeFilePath(storageKey);
  try {
    await writeFile(filePath, file.buffer, { flag: "wx" });
    const previousKey = profile.profilePhotoUrl;
    profile.profilePhotoUrl = storageKey;
    try {
      await profile.save();
    } catch (error) {
      await deleteFileQuietly(storageKey);
      throw error;
    }
    await deleteFileQuietly(previousKey);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.conflict("Could not store the photo, please try again");
  }
  return getStudentProfile(userId);
}

export async function downloadStudentPhoto(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).select("profilePhotoUrl").lean();
  if (!profile) throw AppError.notFound("Student profile not found");
  const key = profile.profilePhotoUrl;
  if (!key) throw AppError.notFound("No profile photo uploaded yet");
  const filePath = safeFilePath(key);
  try {
    const bytes = await readFile(filePath);
    const extension = path.extname(key).slice(1).toLowerCase();
    const mimeType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    return { filename: `profile-photo.${extension || "jpg"}`, mimeType, bytes };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw AppError.notFound("Profile photo file not found in storage");
    }
    throw AppError.conflict("Could not read the profile photo, please try again");
  }
}

export async function removeStudentPhoto(userId: number) {
  const profile = await StudentProfile.findOne({ userId });
  if (!profile) throw AppError.notFound("Student profile not found");
  const previousKey = profile.profilePhotoUrl;
  if (!previousKey) throw AppError.notFound("No profile photo uploaded yet");
  profile.profilePhotoUrl = null;
  await profile.save();
  await deleteFileQuietly(previousKey);
  return getStudentProfile(userId);
}

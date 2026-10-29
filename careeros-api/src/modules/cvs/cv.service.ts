import path from "node:path";
import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import { CvDocument, type CvDocumentDoc } from "../../models/CvDocument.js";
import { Skill } from "../../models/Skill.js";
import { getStudentReadiness } from "../students/readiness.service.js";
import { candidateNameFromText, emailEvidence, extractCvText, phoneEvidence } from "../../lib/cv-text.js";
import { cvAtsScore, cvCompleteness, cvSections, detectedSkillsFromText } from "./cv.analysis.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const ALLOWED_CONTENT_TYPES = new Set([
  ...Object.values(CONTENT_TYPES),
  "application/octet-stream",
]);

function sanitizeFilename(raw: string | undefined): string {
  if (!raw || !raw.trim()) return "cv.pdf";
  const name = raw.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  const cleaned = name.replace(/[^A-Za-z0-9._()\- ]/g, "_");
  if (!cleaned || cleaned.length > 200) return "cv.pdf";
  return cleaned;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot + 1).toLowerCase();
}

function toResponse(document: CvDocumentDoc) {
  return {
    documentId: document._id,
    originalFilename: document.originalFilename,
    contentType: document.contentType,
    fileSize: document.fileSize,
    status: document.status,
    parseError: document.parseError ?? null,
    candidateName: document.candidateName ?? null,
    candidateEmail: document.candidateEmail ?? null,
    candidatePhone: document.candidatePhone ?? null,
    uploadedAt: document.uploadedAt,
  };
}

export async function uploadCv(userId: number, file: Express.Multer.File | undefined) {
  if (!file || file.size === 0) throw AppError.badRequest("Please choose a CV file to upload");
  if (file.size > MAX_FILE_SIZE) throw AppError.badRequest("CV file must be at most 5 MB");
  const originalFilename = sanitizeFilename(file.originalname);
  const extension = extensionOf(originalFilename);
  if (!CONTENT_TYPES[extension]) throw AppError.badRequest("Only PDF, DOC or DOCX files are accepted");
  const declaredType = (file.mimetype || "").toLowerCase();
  if (declaredType && !ALLOWED_CONTENT_TYPES.has(declaredType)) {
    throw AppError.badRequest("Only PDF, DOC or DOCX files are accepted");
  }

  const existing = await CvDocument.findOne({ userId });
  const documentId = existing?._id ?? (await getNextSequence("cv_documents"));
  const now = new Date();
  let extractedText: string | null = null;
  let parseError: string | null = null;
  try {
    extractedText = extractCvText(file.buffer, extension);
    if (!extractedText.trim()) {
      extractedText = null;
      parseError = "We could not read any text from this CV. Upload a text-based PDF or DOCX.";
    }
  } catch (error) {
    parseError = error instanceof Error ? error.message : "We could not read this CV file.";
  }

  const payload = {
    originalFilename,
    contentType: CONTENT_TYPES[extension]!,
    fileSize: file.size,
    status: parseError ? ("FAILED" as const) : ("PARSED" as const),
    parseError,
    candidateName: extractedText ? candidateNameFromText(extractedText) : null,
    candidateEmail: extractedText ? emailEvidence(extractedText) : null,
    candidatePhone: extractedText ? phoneEvidence(extractedText) : null,
    extractedText,
    fileData: file.buffer,
    uploadedAt: now,
  };

  let saved: CvDocumentDoc;
  if (existing) {
    await CvDocument.updateOne({ _id: documentId }, { $set: payload });
    saved = { ...existing.toObject(), ...payload, _id: documentId, updatedAt: now } as CvDocumentDoc;
  } else {
    const created = await CvDocument.create({ _id: documentId, userId, ...payload });
    saved = created.toObject() as CvDocumentDoc;
  }

  if (parseError) throw AppError.badRequest(parseError);
  return toResponse(saved);
}

export async function getMyCv(userId: number) {
  const document = await CvDocument.findOne({ userId }).lean();
  return document ? toResponse(document as CvDocumentDoc) : null;
}

export async function downloadMyCv(userId: number) {
  const document = await CvDocument.findOne({ userId }).select("+fileData").lean();
  if (!document?.fileData) throw AppError.notFound("No CV uploaded yet");
  const raw = document.fileData as unknown as Buffer | { buffer?: Buffer };
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer ?? []);
  return {
    filename: document.originalFilename,
    contentType: document.contentType,
    bytes,
  };
}

export async function analyzeCv(userId: number) {
  return analyzeCvFor(userId);
}

export async function analyzeCvFor(userId: number) {
  const document = await CvDocument.findOne({ userId }).lean();
  if (!document?.extractedText) {
    return {
      hasCv: false,
      hasTarget: false,
      careerId: null,
      careerName: null,
      document: null,
      detectedSkills: [],
      matchedSkills: [],
      missingSkills: [],
      completeness: { scorePercent: 0, totalChecks: 0, passedChecks: 0, strengths: [], suggestions: [] },
      sections: [],
      atsScore: 0,
      overallScore: 0,
    };
  }

  const text = document.extractedText;
  const skills = await Skill.find({ active: true }).sort({ name: 1 }).lean();
  const detectedSkills = detectedSkillsFromText(text, skills);
  const readiness = await getStudentReadiness(userId);
  const detectedIds = new Set(detectedSkills.map((skill) => skill.skillId));
  const matchedSkills = readiness.hasTarget
    ? readiness.gaps.filter((gap: { skillId: number }) => detectedIds.has(gap.skillId))
    : [];
  const missingSkills = readiness.hasTarget
    ? readiness.gaps.filter((gap: { skillId: number }) => !detectedIds.has(gap.skillId))
    : [];
  const completeness = cvCompleteness(text);
  const sections = cvSections(text);
  const atsScore = cvAtsScore(text);
  const frameworkSize = matchedSkills.length + missingSkills.length;
  const alignment = frameworkSize === 0 ? 0 : Math.round((matchedSkills.length * 100) / frameworkSize);
  const overallScore = readiness.hasTarget && frameworkSize > 0
    ? Math.round(completeness.scorePercent * 0.5 + alignment * 0.3 + atsScore * 0.2)
    : Math.round(completeness.scorePercent * 0.6 + atsScore * 0.4);

  return {
    hasCv: true,
    hasTarget: readiness.hasTarget,
    careerId: readiness.targetCareerId ?? null,
    careerName: readiness.targetCareerName ?? null,
    document: toResponse(document as CvDocumentDoc),
    detectedSkills,
    matchedSkills,
    missingSkills,
    completeness,
    sections,
    atsScore,
    overallScore,
  };
}

export function cvFilenameFor(document: { originalFilename: string }) {
  return path.basename(document.originalFilename);
}

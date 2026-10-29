import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import {
  PlacementApplication,
  type ApplicationStage,
  type PlacementApplicationDoc,
  type PlacementOfferDoc,
  type OfferStatus,
} from "../../models/PlacementApplication.js";
import { PlacementDrive, type PlacementDriveDoc } from "../../models/PlacementDrive.js";
import { StudentProfile, type StudentProfileDoc } from "../../models/StudentProfile.js";
import { getStudentReadiness } from "../students/readiness.service.js";

const VISIBLE_STATUSES = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"] as const;

function driveResponse(drive: PlacementDriveDoc) {
  return {
    id: drive._id,
    companyId: null,
    companyName: drive.companyName,
    jobId: null,
    jobTitle: drive.jobTitle,
    name: drive.name,
    location: drive.location ?? null,
    description: drive.description ?? null,
    registrationStart: drive.registrationStart ?? null,
    registrationEnd: drive.registrationEnd ?? null,
    driveDate: drive.driveDate ?? null,
    eligibilityCriteria: drive.eligibilityCriteria ?? null,
    eligibleDepartmentId: drive.eligibleDepartmentId ?? null,
    eligibleDepartmentName: null,
    eligibleProgramId: null,
    eligibleProgramName: null,
    eligibleBatchId: drive.eligibleBatchId ?? null,
    eligibleBatchLabel: null,
    eligibleGraduationYear: drive.eligibleGraduationYear ?? null,
    minimumReadinessPercent: drive.minimumReadinessPercent ?? null,
    status: drive.status,
    applicationCount: null,
    createdAt: drive.createdAt,
    updatedAt: drive.updatedAt,
  };
}

function offerResponse(application: PlacementApplicationDoc, offer: PlacementOfferDoc) {
  return {
    id: offer.id,
    applicationId: application._id,
    packageAmount: offer.packageAmount ?? null,
    currency: offer.currency ?? null,
    offerDate: offer.offerDate ?? null,
    status: offer.status,
    joinedAt: offer.joinedAt ?? null,
    notes: offer.notes ?? null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

function applicationResponse(application: PlacementApplicationDoc, drive: PlacementDriveDoc | undefined) {
  return {
    id: application._id,
    driveId: application.driveId,
    driveName: drive?.name ?? "Placement drive",
    companyId: null,
    companyName: drive?.companyName ?? "Company",
    jobId: null,
    jobTitle: drive?.jobTitle ?? "Role",
    studentEnrollmentId: null,
    studentProfileId: application.studentProfileId,
    studentName: null,
    studentId: null,
    rollNumber: null,
    departmentName: null,
    programName: null,
    batchLabel: null,
    stage: application.stage,
    eligibilityOverride: application.eligibilityOverride,
    overrideReason: application.overrideReason ?? null,
    appliedAt: application.appliedAt,
    updatedAt: application.updatedAt,
    history: (application.history ?? []).map((event) => ({
      id: event.id,
      stage: event.stage,
      note: event.note ?? null,
      recordedByName: null,
      recordedAt: event.recordedAt,
    })),
    offer: application.offer ? offerResponse(application, application.offer) : null,
  };
}

function endOfDay(value: Date): number {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

async function eligibility(
  drive: PlacementDriveDoc,
  profile: StudentProfileDoc,
  userId: number,
): Promise<{ eligible: boolean; reason: string | null }> {
  if (drive.eligibleDepartmentId != null && drive.eligibleDepartmentId !== profile.departmentId) {
    return { eligible: false, reason: "Department is not in the eligible cohort" };
  }
  if (drive.eligibleBatchId != null && drive.eligibleBatchId !== profile.batchId) {
    return { eligible: false, reason: "Batch is not in the eligible cohort" };
  }
  if (drive.eligibleGraduationYear != null && drive.eligibleGraduationYear !== profile.graduationYear) {
    return { eligible: false, reason: "Graduation year does not match" };
  }
  if (drive.minimumReadinessPercent != null && drive.minimumReadinessPercent > 0) {
    const readiness = await getStudentReadiness(userId);
    if (!readiness.hasTarget) {
      return { eligible: false, reason: "Readiness is unavailable; the drive requires a minimum readiness score" };
    }
    if (readiness.readinessPercent < drive.minimumReadinessPercent) {
      return { eligible: false, reason: `Readiness is below the drive minimum of ${drive.minimumReadinessPercent}%` };
    }
  }
  return { eligible: true, reason: null };
}

async function requireProfile(userId: number) {
  const profile = await StudentProfile.findOne({ userId }).lean();
  if (!profile) throw AppError.notFound("Student profile not found");
  return profile as StudentProfileDoc;
}

async function recordStage(application: PlacementApplicationDoc, stage: ApplicationStage, note: string) {
  application.history = [
    ...(application.history ?? []),
    { id: await getNextSequence("placement_stage_events"), stage, note, recordedAt: new Date() },
  ];
}

export async function getMyDrives(userId: number) {
  const profile = await requireProfile(userId);
  const collegeFilter = profile.collegeId == null
    ? { $in: [null] }
    : { $in: [profile.collegeId, null] };
  const drives = await PlacementDrive.find({
    status: { $in: VISIBLE_STATUSES },
    collegeId: collegeFilter,
  }).sort({ createdAt: -1 }).lean();
  const applications = await PlacementApplication.find({
    userId,
    driveId: { $in: drives.map((drive) => drive._id) },
  }).lean();
  const applicationByDrive = new Map(applications.map((application) => [application.driveId, application]));

  const items = await Promise.all(drives.map(async (drive) => {
    const check = await eligibility(drive as PlacementDriveDoc, profile, userId);
    const existing = applicationByDrive.get(drive._id);
    return {
      drive: driveResponse(drive as PlacementDriveDoc),
      eligible: check.eligible,
      eligibilityReason: check.reason,
      alreadyApplied: Boolean(existing),
      applicationId: existing?._id ?? null,
    };
  }));
  return { items, total: items.length };
}

export async function getMyApplications(userId: number) {
  const applications = await PlacementApplication.find({ userId }).sort({ appliedAt: -1 }).lean();
  const drives = await PlacementDrive.find({ _id: { $in: applications.map((application) => application.driveId) } }).lean();
  const driveById = new Map(drives.map((drive) => [drive._id, drive as PlacementDriveDoc]));
  const items = applications.map((application) => applicationResponse(
    application as PlacementApplicationDoc,
    driveById.get(application.driveId),
  ));
  return { items, total: items.length };
}

export async function registerForDrive(userId: number, driveId: number) {
  const profile = await requireProfile(userId);
  const drive = await PlacementDrive.findById(driveId).lean();
  if (!drive || (drive.collegeId != null && drive.collegeId !== profile.collegeId)) {
    throw AppError.notFound("Placement drive not found");
  }
  if (drive.status !== "REGISTRATION_OPEN") {
    throw AppError.badRequest("Registration is not open for this drive");
  }
  if (drive.registrationEnd && endOfDay(drive.registrationEnd) < Date.now()) {
    throw AppError.badRequest("The registration deadline has passed");
  }
  const existing = await PlacementApplication.findOne({ driveId, studentProfileId: profile._id }).lean();
  if (existing) throw AppError.conflict("You are already registered for this drive");
  const check = await eligibility(drive as PlacementDriveDoc, profile, userId);
  if (!check.eligible) {
    throw AppError.badRequest(`You are not eligible for this drive: ${check.reason ?? "eligibility rules not met"}`);
  }

  const applicationId = await getNextSequence("placement_applications");
  const application: PlacementApplicationDoc = {
    _id: applicationId,
    driveId,
    userId,
    studentProfileId: profile._id,
    collegeId: profile.collegeId ?? null,
    stage: "REGISTERED",
    eligibilityOverride: false,
    overrideReason: null,
    appliedAt: new Date(),
    history: [],
    offer: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await recordStage(application, "REGISTERED", "Student registered");
  const saved = await PlacementApplication.create(application);
  return applicationResponse(saved.toObject() as PlacementApplicationDoc, drive as PlacementDriveDoc);
}

export async function withdrawMyApplication(userId: number, applicationId: number) {
  const application = await PlacementApplication.findOne({ _id: applicationId, userId });
  if (!application) throw AppError.notFound("Application not found");
  if (application.stage === "JOINED") throw AppError.badRequest("A joined application cannot be withdrawn");
  if (application.offer?.status === "JOINED") throw AppError.badRequest("A joined offer cannot be withdrawn");
  application.stage = "WITHDRAWN";
  if (application.offer && application.offer.status !== "WITHDRAWN") {
    application.offer.status = "WITHDRAWN";
    application.offer.joinedAt = null;
  }
  await recordStage(application, "WITHDRAWN", "Withdrawn by student");
  await application.save();
  const drive = await PlacementDrive.findById(application.driveId).lean();
  return applicationResponse(application.toObject() as PlacementApplicationDoc, drive as PlacementDriveDoc | undefined);
}

export async function respondToOffer(userId: number, offerId: number, status: OfferStatus) {
  if (status !== "ACCEPTED" && status !== "DECLINED") {
    throw AppError.badRequest("Students may only accept or decline an offer");
  }
  const application = await PlacementApplication.findOne({ userId, "offer.id": offerId });
  if (!application?.offer) throw AppError.notFound("Offer not found");
  if (application.offer.status === "JOINED" || application.offer.status === "WITHDRAWN") {
    throw AppError.badRequest("This offer can no longer be changed by the student");
  }
  application.offer.status = status;
  await application.save();
  return offerResponse(application.toObject() as PlacementApplicationDoc, application.offer);
}

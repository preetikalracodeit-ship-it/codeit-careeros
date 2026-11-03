import { AppError } from "../../lib/errors.js";
import { recordInstitutionEvent } from "../../lib/audit.js";
import { withTransaction } from "../../lib/db.js";
import { getNextSequence } from "../../models/Counter.js";
import { Company, type CompanyDoc, type CompanyStatus } from "../../models/Company.js";
import { JobOpening, type JobOpeningDoc, type JobStatus, type EmploymentType } from "../../models/JobOpening.js";
import { PlacementDrive, type PlacementDriveDoc, type DriveStatus } from "../../models/PlacementDrive.js";
import {
  APPLICATION_STAGES,
  OFFER_STATUSES,
  PlacementApplication,
  type ApplicationStage,
  type PlacementApplicationDoc,
  type PlacementOfferDoc,
  type OfferStatus,
} from "../../models/PlacementApplication.js";
import { Department } from "../../models/Department.js";
import { Program } from "../../models/Program.js";
import { Batch } from "../../models/Batch.js";
import { StudentEnrollment } from "../../models/StudentEnrollment.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { User } from "../../models/User.js";
import { getStudentReadiness } from "../students/readiness.service.js";
import { loadCohort, type CohortRow } from "./studentEnrollment.service.js";
import {
  requireManageApplications,
  requireManageCompaniesAndJobs,
  requireManageDrives,
  requirePlacementAccess,
  type CollegeScope,
} from "./collegeScope.service.js";

type CompanyInput = {
  name?: string;
  industry?: string | null;
  sector?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  recruitmentStatus?: CompanyStatus;
  source?: string | null;
  notes?: string | null;
};

type JobInput = {
  companyId?: number;
  title?: string;
  description?: string | null;
  requiredSkills?: string | null;
  location?: string | null;
  employmentType?: EmploymentType | null;
  eligibilityCriteria?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  applicationDeadline?: string | null;
  status?: JobStatus;
};

type DriveInput = {
  companyId?: number;
  jobId?: number;
  name?: string;
  registrationStart?: string | null;
  registrationEnd?: string | null;
  driveDate?: string | null;
  eligibilityCriteria?: string | null;
  eligibleDepartmentId?: number | null;
  eligibleProgramId?: number | null;
  eligibleBatchId?: number | null;
  eligibleGraduationYear?: number | null;
  minimumReadinessPercent?: number | null;
  status?: DriveStatus;
};

function clean(value: string | null | undefined, max: number): string | null {
  const result = value?.replace(/[\r\n\t]+/g, " ").trim() ?? "";
  if (result.length > max) throw AppError.badRequest(`Value must be at most ${max} characters`);
  return result || null;
}

function requiredText(value: string | undefined, label: string, max: number): string {
  const result = value?.trim() ?? "";
  if (!result) throw AppError.badRequest(`${label} is required`);
  if (result.length > max) throw AppError.badRequest(`${label} must be at most ${max} characters`);
  return result;
}

function nullableDate(value: string | null | undefined, label: string): Date | null {
  if (value == null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw AppError.badRequest(`${label} must be a valid date`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw AppError.badRequest(`${label} must be a valid date`);
  }
  return date;
}

function dateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function companyResponse(company: CompanyDoc, scope: CollegeScope) {
  const contacts = ["COLLEGE_ADMIN", "TPO"].includes(scope.designation);
  return {
    id: company._id,
    name: company.name,
    industry: company.industry ?? null,
    sector: company.sector ?? null,
    website: company.website ?? null,
    contactName: contacts ? company.contactName ?? null : null,
    contactEmail: contacts ? company.contactEmail ?? null : null,
    contactPhone: contacts ? company.contactPhone ?? null : null,
    recruitmentStatus: company.recruitmentStatus,
    source: company.source ?? null,
    notes: contacts ? company.notes ?? null : null,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

function jobResponse(job: JobOpeningDoc, company: CompanyDoc) {
  return {
    id: job._id,
    companyId: company._id,
    companyName: company.name,
    title: job.title,
    description: job.description ?? null,
    requiredSkills: job.requiredSkills ?? null,
    location: job.location ?? null,
    employmentType: job.employmentType ?? null,
    eligibilityCriteria: job.eligibilityCriteria ?? null,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    currency: job.currency ?? null,
    applicationDeadline: job.applicationDeadline ?? null,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function companyFor(scope: CollegeScope, companyId: number | undefined) {
  if (!companyId || !Number.isSafeInteger(companyId) || companyId < 1) {
    throw AppError.badRequest("A company is required");
  }
  const company = await Company.findOne({ _id: companyId, institutionId: scope.institutionId }).lean();
  if (!company) throw AppError.notFound("Company not found");
  return company as CompanyDoc;
}

async function jobFor(scope: CollegeScope, jobId: number | undefined) {
  if (!jobId || !Number.isSafeInteger(jobId) || jobId < 1) throw AppError.badRequest("A job is required");
  const job = await JobOpening.findOne({ _id: jobId, institutionId: scope.institutionId }).lean();
  if (!job) throw AppError.notFound("Job opening not found");
  return job as JobOpeningDoc;
}

export async function listPlacementCompanies(scope: CollegeScope) {
  requirePlacementAccess(scope);
  const companies = await Company.find({ institutionId: scope.institutionId }).sort({ name: 1 }).lean();
  return companies.map((company) => companyResponse(company as CompanyDoc, scope));
}

export async function createPlacementCompany(scope: CollegeScope, input: CompanyInput) {
  requireManageCompaniesAndJobs(scope);
  const name = requiredText(input?.name, "A company name", 180);
  if (await Company.exists({ institutionId: scope.institutionId, name }).collation({ locale: "en", strength: 2 })) {
    throw AppError.conflict("A company with this name already exists");
  }
  const id = await getNextSequence("placement_companies");
  try {
    const company = await Company.create({
      _id: id,
      institutionId: scope.institutionId,
      name,
      industry: clean(input.industry, 120),
      sector: clean(input.sector, 120),
      website: clean(input.website, 250),
      contactName: clean(input.contactName, 120),
      contactEmail: clean(input.contactEmail, 190),
      contactPhone: clean(input.contactPhone, 30),
      recruitmentStatus: input.recruitmentStatus ?? "PROSPECT",
      source: clean(input.source, 120),
      notes: clean(input.notes, 1000),
      createdBy: scope.userId,
    });
    await recordInstitutionEvent({
      actorUserId: scope.userId, actorRole: scope.designation, actorEmail: scope.user.email,
      action: "PLACEMENT_COMPANY_CREATE", targetType: "PLACEMENT_COMPANY", targetId: String(id),
      institutionId: scope.institutionId, details: `name=${name}`,
    });
    return companyResponse(company.toObject() as CompanyDoc, scope);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      throw AppError.conflict("A company with this name already exists");
    }
    throw error;
  }
}

export async function updatePlacementCompany(scope: CollegeScope, companyId: number, input: CompanyInput) {
  requireManageCompaniesAndJobs(scope);
  const company = await Company.findOne({ _id: companyId, institutionId: scope.institutionId });
  if (!company) throw AppError.notFound("Company not found");
  const name = requiredText(input?.name, "A company name", 180);
  if (name.toLowerCase() !== company.name.toLowerCase() &&
      await Company.exists({ institutionId: scope.institutionId, name }).collation({ locale: "en", strength: 2 })) {
    throw AppError.conflict("A company with this name already exists");
  }
  company.name = name;
  company.industry = clean(input.industry, 120);
  company.sector = clean(input.sector, 120);
  company.website = clean(input.website, 250);
  company.contactName = clean(input.contactName, 120);
  company.contactEmail = clean(input.contactEmail, 190);
  company.contactPhone = clean(input.contactPhone, 30);
  company.recruitmentStatus = input.recruitmentStatus ?? company.recruitmentStatus;
  company.source = clean(input.source, 120);
  company.notes = clean(input.notes, 1000);
  await company.save();
  await recordInstitutionEvent({
    actorUserId: scope.userId, actorRole: scope.designation, actorEmail: scope.user.email,
    action: "PLACEMENT_COMPANY_UPDATE", targetType: "PLACEMENT_COMPANY", targetId: String(companyId),
    institutionId: scope.institutionId, details: `status=${company.recruitmentStatus}`,
  });
  return companyResponse(company.toObject() as CompanyDoc, scope);
}

export async function listPlacementJobs(
  scope: CollegeScope,
  filters: { companyId?: number; status?: JobStatus },
) {
  requirePlacementAccess(scope);
  let companyId = filters.companyId;
  if (companyId != null) companyId = (await companyFor(scope, companyId))._id;
  const jobs = await JobOpening.find({
    institutionId: scope.institutionId,
    ...(companyId == null ? {} : { companyId }),
    ...(filters.status == null ? {} : { status: filters.status }),
  }).sort({ createdAt: -1 }).lean();
  const companies = await Company.find({ _id: { $in: [...new Set(jobs.map((job) => job.companyId))] } }).lean();
  const companyById = new Map(companies.map((company) => [company._id, company as CompanyDoc]));
  return jobs.flatMap((job) => {
    const company = companyById.get(job.companyId);
    return company ? [jobResponse(job as JobOpeningDoc, company)] : [];
  });
}

function validateSalary(min?: number | null, max?: number | null) {
  if ((min != null && min < 0) || (max != null && max < 0)) throw AppError.badRequest("Salary cannot be negative");
  if (min != null && max != null && min > max) throw AppError.badRequest("Salary minimum cannot exceed salary maximum");
}

function jobValues(input: JobInput) {
  const title = requiredText(input?.title, "A job title", 180);
  validateSalary(input.salaryMin, input.salaryMax);
  return {
    title,
    description: clean(input.description, 4000),
    requiredSkills: clean(input.requiredSkills, 1000),
    location: clean(input.location, 160),
    employmentType: input.employmentType ?? null,
    eligibilityCriteria: clean(input.eligibilityCriteria, 2000),
    salaryMin: input.salaryMin ?? null,
    salaryMax: input.salaryMax ?? null,
    currency: clean(input.currency, 10),
    applicationDeadline: input.applicationDeadline ?? null,
  };
}

export async function createPlacementJob(scope: CollegeScope, input: JobInput) {
  requireManageCompaniesAndJobs(scope);
  const company = await companyFor(scope, input?.companyId);
  const values = jobValues(input);
  const id = await getNextSequence("placement_jobs");
  const job = await JobOpening.create({
    _id: id, institutionId: scope.institutionId, companyId: company._id,
    ...values, status: input.status ?? "DRAFT", createdBy: scope.userId,
  });
  await recordInstitutionEvent({
    actorUserId: scope.userId, actorRole: scope.designation, actorEmail: scope.user.email,
    action: "PLACEMENT_JOB_CREATE", targetType: "PLACEMENT_JOB", targetId: String(id),
    institutionId: scope.institutionId, details: `companyId=${company._id}`,
  });
  return jobResponse(job.toObject() as JobOpeningDoc, company);
}

export async function updatePlacementJob(scope: CollegeScope, jobId: number, input: JobInput) {
  requireManageCompaniesAndJobs(scope);
  const job = await JobOpening.findOne({ _id: jobId, institutionId: scope.institutionId });
  if (!job) throw AppError.notFound("Job opening not found");
  const company = await companyFor(scope, input?.companyId);
  const values = jobValues(input);
  Object.assign(job, values, { companyId: company._id, status: input.status ?? job.status });
  await job.save();
  await recordInstitutionEvent({
    actorUserId: scope.userId, actorRole: scope.designation, actorEmail: scope.user.email,
    action: "PLACEMENT_JOB_UPDATE", targetType: "PLACEMENT_JOB", targetId: String(jobId),
    institutionId: scope.institutionId, details: `status=${job.status}`,
  });
  return jobResponse(job.toObject() as JobOpeningDoc, company);
}

async function driveContext(scope: CollegeScope, drive: PlacementDriveDoc) {
  const company = await Company.findOne({ _id: drive.companyId, institutionId: scope.institutionId }).lean();
  const job = await JobOpening.findOne({ _id: drive.jobId, institutionId: scope.institutionId }).lean();
  const [department, program, batch, applicationCount] = await Promise.all([
    drive.eligibleDepartmentId == null ? null : Department.findOne({ _id: drive.eligibleDepartmentId, institutionId: scope.institutionId }).lean(),
    drive.eligibleProgramId == null ? null : Program.findOne({ _id: drive.eligibleProgramId, institutionId: scope.institutionId }).lean(),
    drive.eligibleBatchId == null ? null : Batch.findById(drive.eligibleBatchId).lean(),
    PlacementApplication.countDocuments({ driveId: drive._id }),
  ]);
  if (!company || !job) throw AppError.notFound("Placement drive not found");
  return {
    company: company as CompanyDoc,
    job: job as JobOpeningDoc,
    department,
    program,
    batch,
    applicationCount,
  };
}

async function driveResponse(scope: CollegeScope, drive: PlacementDriveDoc) {
  const context = await driveContext(scope, drive);
  return {
    id: drive._id,
    companyId: context.company._id,
    companyName: context.company.name,
    jobId: context.job._id,
    jobTitle: context.job.title,
    name: drive.name,
    registrationStart: dateOnly(drive.registrationStart),
    registrationEnd: dateOnly(drive.registrationEnd),
    driveDate: dateOnly(drive.driveDate),
    eligibilityCriteria: drive.eligibilityCriteria ?? null,
    eligibleDepartmentId: drive.eligibleDepartmentId ?? null,
    eligibleDepartmentName: context.department?.name ?? null,
    eligibleProgramId: drive.eligibleProgramId ?? null,
    eligibleProgramName: context.program?.name ?? null,
    eligibleBatchId: drive.eligibleBatchId ?? null,
    eligibleBatchLabel: context.batch?.label ?? null,
    eligibleGraduationYear: drive.eligibleGraduationYear ?? null,
    minimumReadinessPercent: drive.minimumReadinessPercent ?? null,
    status: drive.status,
    applicationCount: context.applicationCount,
    createdAt: drive.createdAt,
    updatedAt: drive.updatedAt,
  };
}

async function driveFor(scope: CollegeScope, id: number) {
  const drive = await PlacementDrive.findOne({ _id: id, institutionId: scope.institutionId }).lean();
  if (!drive) throw AppError.notFound("Placement drive not found");
  return drive as PlacementDriveDoc;
}

async function validateTargets(scope: CollegeScope, input: DriveInput) {
  const [department, program, batch] = await Promise.all([
    input.eligibleDepartmentId == null ? null :
      Department.findOne({ _id: input.eligibleDepartmentId, institutionId: scope.institutionId }).lean(),
    input.eligibleProgramId == null ? null :
      Program.findOne({ _id: input.eligibleProgramId, institutionId: scope.institutionId }).lean(),
    input.eligibleBatchId == null ? null : Batch.findById(input.eligibleBatchId).lean(),
  ]);
  if (input.eligibleDepartmentId != null && !department) throw AppError.notFound("Department not found");
  if (input.eligibleProgramId != null && (!program || program.institutionId !== scope.institutionId)) {
    throw AppError.notFound("Program not found");
  }
  if (input.eligibleBatchId != null && (!batch || !(await Program.exists({
    _id: batch.programId,
    institutionId: scope.institutionId,
  })))) throw AppError.notFound("Batch not found");
  if (department && program && program.departmentId !== department._id) {
    throw AppError.badRequest("The eligible program does not belong to the eligible department");
  }
  if (program && batch && batch.programId !== program._id) {
    throw AppError.badRequest("The eligible batch does not belong to the eligible program");
  }
  if (department && batch) {
    const parentProgram = await Program.findById(batch.programId).lean();
    if (parentProgram?.departmentId !== department._id) {
      throw AppError.badRequest("The eligible batch does not belong to the eligible department");
    }
  }
  const year = input.eligibleGraduationYear;
  if (year != null && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
    throw AppError.badRequest("Eligible graduation year must be between 2000 and 2100");
  }
  const readiness = input.minimumReadinessPercent;
  if (readiness != null && (!Number.isInteger(readiness) || readiness < 0 || readiness > 100)) {
    throw AppError.badRequest("Minimum readiness must be between 0 and 100");
  }
  return { department, program, batch };
}

function driveValues(input: DriveInput) {
  const name = requiredText(input?.name, "A drive name", 180);
  const registrationStart = nullableDate(input.registrationStart, "Registration start");
  const registrationEnd = nullableDate(input.registrationEnd, "Registration end");
  const driveDate = nullableDate(input.driveDate, "Drive date");
  if (registrationStart && registrationEnd && registrationStart > registrationEnd) {
    throw AppError.badRequest("Registration start must be on or before the deadline");
  }
  return {
    name,
    registrationStart,
    registrationEnd,
    driveDate,
    eligibilityCriteria: clean(input.eligibilityCriteria, 2000),
    eligibleGraduationYear: input.eligibleGraduationYear ?? null,
    minimumReadinessPercent: input.minimumReadinessPercent ?? null,
  };
}

async function prepareDrive(scope: CollegeScope, input: DriveInput) {
  if (!input?.companyId || !input.jobId) throw AppError.badRequest("A company and job are required");
  const company = await companyFor(scope, input.companyId);
  const job = await jobFor(scope, input.jobId);
  if (job.companyId !== company._id) {
    throw AppError.badRequest("The selected job does not belong to the selected company");
  }
  const targets = await validateTargets(scope, input);
  return { company, job, targets, values: driveValues(input) };
}

export async function listPlacementDrives(scope: CollegeScope, status?: DriveStatus) {
  requirePlacementAccess(scope);
  const drives = await PlacementDrive.find({
    institutionId: scope.institutionId,
    ...(status ? { status } : {}),
  }).sort({ createdAt: -1 }).lean();
  return Promise.all(drives.map((drive) => driveResponse(scope, drive as PlacementDriveDoc)));
}

export async function createPlacementDrive(scope: CollegeScope, input: DriveInput) {
  requireManageDrives(scope);
  const prepared = await prepareDrive(scope, input);
  const id = await getNextSequence("placement_drives");
  const drive = await PlacementDrive.create({
    _id: id,
    institutionId: scope.institutionId,
    companyId: prepared.company._id,
    jobId: prepared.job._id,
    companyName: prepared.company.name,
    jobTitle: prepared.job.title,
    name: prepared.values.name,
    registrationStart: prepared.values.registrationStart,
    registrationEnd: prepared.values.registrationEnd,
    driveDate: prepared.values.driveDate,
    eligibilityCriteria: prepared.values.eligibilityCriteria,
    eligibleDepartmentId: prepared.targets.department?._id ?? null,
    eligibleProgramId: prepared.targets.program?._id ?? null,
    eligibleBatchId: prepared.targets.batch?._id ?? null,
    eligibleGraduationYear: prepared.values.eligibleGraduationYear,
    minimumReadinessPercent: prepared.values.minimumReadinessPercent,
    status: input.status ?? "DRAFT",
    createdBy: scope.userId,
  });
  await recordInstitutionEvent({
    actorUserId: scope.userId, actorRole: scope.designation, actorEmail: scope.user.email,
    action: "PLACEMENT_DRIVE_CREATE", targetType: "PLACEMENT_DRIVE", targetId: String(id),
    institutionId: scope.institutionId, details: `companyId=${prepared.company._id}`,
  });
  return driveResponse(scope, drive.toObject() as PlacementDriveDoc);
}

export async function updatePlacementDrive(scope: CollegeScope, driveId: number, input: DriveInput) {
  requireManageDrives(scope);
  const drive = await PlacementDrive.findOne({ _id: driveId, institutionId: scope.institutionId });
  if (!drive) throw AppError.notFound("Placement drive not found");
  const prepared = await prepareDrive(scope, input);
  Object.assign(drive, {
    companyId: prepared.company._id,
    jobId: prepared.job._id,
    companyName: prepared.company.name,
    jobTitle: prepared.job.title,
    ...prepared.values,
    eligibleDepartmentId: prepared.targets.department?._id ?? null,
    eligibleProgramId: prepared.targets.program?._id ?? null,
    eligibleBatchId: prepared.targets.batch?._id ?? null,
    status: input.status ?? drive.status,
  });
  await drive.save();
  await recordInstitutionEvent({
    actorUserId: scope.userId, actorRole: scope.designation, actorEmail: scope.user.email,
    action: "PLACEMENT_DRIVE_UPDATE", targetType: "PLACEMENT_DRIVE", targetId: String(driveId),
    institutionId: scope.institutionId, details: `status=${drive.status}`,
  });
  return driveResponse(scope, drive.toObject() as PlacementDriveDoc);
}

async function cohortForDrive(scope: CollegeScope, drive: PlacementDriveDoc) {
  const cohort = await loadCohort(scope, { status: "ACTIVE" });
  const rows = cohort.filter((row) =>
    (drive.eligibleDepartmentId == null || row.enrollment.departmentId === drive.eligibleDepartmentId) &&
    (drive.eligibleProgramId == null || row.enrollment.programId === drive.eligibleProgramId) &&
    (drive.eligibleBatchId == null || row.enrollment.batchId === drive.eligibleBatchId) &&
    (drive.eligibleGraduationYear == null || row.batch.graduationYear === drive.eligibleGraduationYear),
  );
  const applications = await PlacementApplication.find({
    institutionId: scope.institutionId,
    driveId: drive._id,
    studentProfileId: { $in: rows.map((row) => row.profile._id) },
  }).select("_id studentProfileId").lean();
  const appByStudent = new Map(applications.map((application) => [application.studentProfileId, application._id]));
  return Promise.all(rows.map(async (row) => {
    const readiness = drive.minimumReadinessPercent == null
      ? null
      : await getStudentReadiness(row.userId);
    const readinessPercent = readiness?.hasTarget ? readiness.readinessPercent : null;
    let reason: string | null = null;
    if (drive.minimumReadinessPercent != null && readinessPercent == null) {
      reason = "Readiness is unavailable; the drive requires a minimum readiness score";
    } else if (drive.minimumReadinessPercent != null && readinessPercent! < drive.minimumReadinessPercent) {
      reason = "Readiness is below the drive minimum";
    }
    return {
      enrollmentId: row.enrollment._id,
      studentProfileId: row.profile._id,
      studentId: row.profile.studentId,
      rollNumber: row.enrollment.rollNumber,
      fullName: row.profile.fullName,
      departmentName: row.department.name,
      programName: row.program.name,
      batchLabel: row.batch.label,
      graduationYear: row.batch.graduationYear ?? null,
      readinessPercent,
      eligible: reason == null,
      reason,
      alreadyApplied: appByStudent.has(row.profile._id),
      applicationId: appByStudent.get(row.profile._id) ?? null,
      _row: row,
    };
  }));
}

function offerResponse(application: PlacementApplicationDoc, offer: PlacementOfferDoc) {
  return {
    id: offer.id,
    applicationId: application._id,
    packageAmount: offer.packageAmount ?? null,
    currency: offer.currency ?? null,
    offerDate: dateOnly(offer.offerDate),
    status: offer.status,
    joinedAt: dateOnly(offer.joinedAt),
    notes: offer.notes ?? null,
    createdAt: offer.createdAt ?? application.createdAt,
    updatedAt: offer.updatedAt ?? application.updatedAt,
  };
}

async function applicationResponse(scope: CollegeScope, application: PlacementApplicationDoc) {
  const [drive, profile, enrollment, events] = await Promise.all([
    PlacementDrive.findOne({ _id: application.driveId, institutionId: scope.institutionId }).lean(),
    StudentProfile.findById(application.studentProfileId).lean(),
    StudentEnrollment.findOne({ studentProfileId: application.studentProfileId, institutionId: scope.institutionId }).lean(),
    User.find({ _id: { $in: (application.history ?? []).map((event) => event.recordedBy).filter((id): id is number => id != null) } })
      .select("_id fullName").lean(),
  ]);
  if (!drive) throw AppError.notFound("Placement drive not found");
  const driveCtx = await driveContext(scope, drive as PlacementDriveDoc);
  const [department, program, batch, historyNames] = await Promise.all([
    enrollment ? Department.findById(enrollment.departmentId).lean() : null,
    enrollment ? Program.findById(enrollment.programId).lean() : null,
    enrollment ? Batch.findById(enrollment.batchId).lean() : null,
    Promise.resolve(new Map(events.map((user) => [user._id, user.fullName]))),
  ]);
  return {
    id: application._id,
    driveId: drive._id,
    driveName: drive.name,
    companyId: driveCtx.company._id,
    companyName: driveCtx.company.name,
    jobId: driveCtx.job._id,
    jobTitle: driveCtx.job.title,
    studentEnrollmentId: enrollment?._id ?? null,
    studentProfileId: application.studentProfileId,
    studentName: profile?.fullName ?? null,
    studentId: profile?.studentId ?? null,
    rollNumber: enrollment?.rollNumber ?? null,
    departmentName: department?.name ?? null,
    programName: program?.name ?? null,
    batchLabel: batch?.label ?? null,
    stage: application.stage,
    eligibilityOverride: application.eligibilityOverride,
    overrideReason: application.overrideReason ?? null,
    appliedAt: application.appliedAt,
    updatedAt: application.updatedAt,
    history: (application.history ?? []).map((event) => ({
      id: event.id,
      stage: event.stage,
      note: event.note ?? null,
      recordedByName: event.recordedBy == null ? null : historyNames.get(event.recordedBy) ?? null,
      recordedAt: event.recordedAt,
    })),
    offer: application.offer ? offerResponse(application, application.offer) : null,
  };
}

export async function getPlacementDriveDetail(scope: CollegeScope, driveId: number) {
  requirePlacementAccess(scope);
  const drive = await driveFor(scope, driveId);
  const eligibleStudents = await cohortForDrive(scope, drive);
  const applications = await PlacementApplication.find({ institutionId: scope.institutionId, driveId })
    .sort({ appliedAt: 1 }).lean();
  const scopedIds = new Set(eligibleStudents.map((item) => item.studentProfileId));
  const visibleApplications = applications.filter((application) => scopedIds.has(application.studentProfileId));
  return {
    drive: await driveResponse(scope, drive),
    eligibleStudents: eligibleStudents.map(({ _row: _unused, ...student }) => student),
    applications: await Promise.all(visibleApplications.map((application) =>
      applicationResponse(scope, application as PlacementApplicationDoc))),
  };
}

export async function listEligibleDriveStudents(scope: CollegeScope, driveId: number) {
  requirePlacementAccess(scope);
  const drive = await driveFor(scope, driveId);
  return (await cohortForDrive(scope, drive)).map(({ _row: _unused, ...student }) => student);
}

async function recordStage(
  application: PlacementApplicationDoc,
  stage: ApplicationStage,
  note: string | null,
  scope: CollegeScope,
  session: import("mongoose").ClientSession,
) {
  application.history.push({
    id: await getNextSequence("placement_stage_events", session),
    stage,
    note,
    recordedBy: scope.userId,
    recordedByName: scope.user.fullName,
    recordedAt: new Date(),
  });
}

async function scopedEnrollment(scope: CollegeScope, enrollmentId: number): Promise<CohortRow> {
  const cohort = await loadCohort(scope);
  const row = cohort.find((candidate) => candidate.enrollment._id === enrollmentId);
  if (!row) throw AppError.notFound("Student enrollment not found");
  return row;
}

export async function createDriveApplication(
  scope: CollegeScope,
  driveId: number,
  input: { enrollmentId?: number; override?: boolean; overrideReason?: string | null },
) {
  requireManageApplications(scope);
  const drive = await driveFor(scope, driveId);
  const enrollmentId = input?.enrollmentId;
  if (!enrollmentId) throw AppError.badRequest("A student enrollment is required");
  const row = await scopedEnrollment(scope, enrollmentId);
  if (await PlacementApplication.exists({ driveId, studentProfileId: row.profile._id })) {
    throw AppError.conflict("The student is already registered for this drive");
  }
  const checks = await cohortForDrive(scope, drive);
  const eligibleRow = checks.find((candidate) => candidate.studentProfileId === row.profile._id);
  const eligible = Boolean(eligibleRow?.eligible);
  const override = input.override === true;
  if (!eligible && !override) {
    throw AppError.badRequest(`The student is not eligible for this drive: ${eligibleRow?.reason ?? "eligibility rules not met"}`);
  }
  const overrideReason = clean(input.overrideReason, 500);
  if (!eligible && !overrideReason) throw AppError.badRequest("An eligibility override reason is required");
  const applicationId = await getNextSequence("placement_applications");
  const now = new Date();
  const application: PlacementApplicationDoc = {
    _id: applicationId,
    institutionId: scope.institutionId,
    driveId,
    userId: row.userId,
    studentProfileId: row.profile._id,
    collegeId: scope.institutionId,
    stage: "REGISTERED",
    eligibilityOverride: !eligible,
    overrideReason: eligible ? null : overrideReason,
    appliedAt: now,
    history: [],
    offer: null,
    createdAt: now,
    updatedAt: now,
  };
  await withTransaction(async (session) => {
    await recordStage(application, "REGISTERED", eligible ? "Registered" : `Registered with eligibility override: ${overrideReason}`, scope, session);
    await PlacementApplication.create([application], { session });
    await recordInstitutionEvent({
      actorUserId: scope.userId, actorRole: scope.designation, actorEmail: scope.user.email,
      action: "PLACEMENT_APPLICATION_CREATE", targetType: "PLACEMENT_APPLICATION", targetId: String(applicationId),
      institutionId: scope.institutionId, details: `driveId=${driveId},override=${!eligible}`, session,
    });
  });
  return applicationResponse(scope, application);
}

async function requireApplication(scope: CollegeScope, applicationId: number) {
  const application = await PlacementApplication.findOne({ _id: applicationId, institutionId: scope.institutionId });
  if (!application) throw AppError.notFound("Application not found");
  const enrollment = await StudentEnrollment.findOne({
    studentProfileId: application.studentProfileId,
    institutionId: scope.institutionId,
  }).lean();
  if (!enrollment || !(await loadCohort(scope)).some((row) => row.enrollment._id === enrollment._id)) {
    throw AppError.notFound("Application not found");
  }
  return application;
}

export async function updateDriveApplication(
  scope: CollegeScope,
  applicationId: number,
  input: { stage?: ApplicationStage; note?: string | null },
) {
  requireManageApplications(scope);
  if (!input?.stage || !(APPLICATION_STAGES as readonly string[]).includes(input.stage)) {
    throw AppError.badRequest("An application stage is required");
  }
  let updated!: PlacementApplicationDoc;
  await withTransaction(async (session) => {
    const application = await requireApplication(scope, applicationId);
    application.stage = input.stage!;
    await recordStage(application, input.stage!, clean(input.note, 500), scope, session);
    await application.save({ session });
    updated = application.toObject() as PlacementApplicationDoc;
    await recordInstitutionEvent({
      actorUserId: scope.userId, actorRole: scope.designation, actorEmail: scope.user.email,
      action: "PLACEMENT_APPLICATION_STAGE_UPDATE", targetType: "PLACEMENT_APPLICATION",
      targetId: String(applicationId), institutionId: scope.institutionId,
      details: `stage=${input.stage}`, session,
    });
  });
  return applicationResponse(scope, updated);
}

type OfferInput = {
  packageAmount?: number | null;
  currency?: string | null;
  offerDate?: string | null;
  joinedAt?: string | null;
  status?: OfferStatus;
  notes?: string | null;
};

function validateOfferInput(input: OfferInput) {
  if (input.packageAmount != null && (!Number.isFinite(input.packageAmount) || input.packageAmount < 0)) {
    throw AppError.badRequest("Package amount cannot be negative");
  }
  if (input.status && !(OFFER_STATUSES as readonly string[]).includes(input.status)) {
    throw AppError.badRequest("An offer status is required");
  }
}

function localDateNow(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function createApplicationOffer(scope: CollegeScope, applicationId: number, input: OfferInput) {
  requireManageApplications(scope);
  if (!input) throw AppError.badRequest("Offer details are required");
  validateOfferInput(input);
  let applicationResult!: PlacementApplicationDoc;
  await withTransaction(async (session) => {
    const application = await requireApplication(scope, applicationId);
    if (application.offer) throw AppError.conflict("This application already has an offer");
    const status = input.status ?? "PENDING";
    const now = new Date();
    const joinedAt = status === "JOINED" ? nullableDate(input.joinedAt, "Joining date") ?? nullableDate(localDateNow(scope.timezone), "Joining date") : null;
    const offer: PlacementOfferDoc = {
      id: await getNextSequence("placement_offers", session),
      packageAmount: input.packageAmount ?? null,
      currency: clean(input.currency, 10),
      offerDate: nullableDate(input.offerDate, "Offer date") ?? nullableDate(localDateNow(scope.timezone), "Offer date"),
      status,
      joinedAt,
      notes: clean(input.notes, 500),
      createdAt: now,
      updatedAt: now,
    };
    application.offer = offer;
    if (status === "JOINED") {
      application.stage = "JOINED";
      await recordStage(application, "JOINED", "Offer recorded with joining", scope, session);
    } else if (application.stage !== "OFFERED" && application.stage !== "JOINED") {
      application.stage = "OFFERED";
      await recordStage(application, "OFFERED", "Offer recorded", scope, session);
    }
    await application.save({ session });
    applicationResult = application.toObject() as PlacementApplicationDoc;
    await recordInstitutionEvent({
      actorUserId: scope.userId, actorRole: scope.designation, actorEmail: scope.user.email,
      action: "PLACEMENT_OFFER_CREATE", targetType: "PLACEMENT_OFFER", targetId: String(offer.id),
      institutionId: scope.institutionId, details: `applicationId=${applicationId}`, session,
    });
  });
  if (!applicationResult.offer) throw AppError.internal("Could not save placement offer");
  return offerResponse(applicationResult, applicationResult.offer);
}

export async function updateApplicationOffer(scope: CollegeScope, offerId: number, input: OfferInput) {
  requireManageApplications(scope);
  if (!input?.status || !(OFFER_STATUSES as readonly string[]).includes(input.status)) {
    throw AppError.badRequest("An offer status is required");
  }
  validateOfferInput(input);
  let result!: { app: PlacementApplicationDoc; offer: PlacementOfferDoc };
  await withTransaction(async (session) => {
    const application = await PlacementApplication.findOne({
      institutionId: scope.institutionId,
      "offer.id": offerId,
    });
    if (!application) throw AppError.notFound("Offer not found");
    await requireApplication(scope, application._id);
    const offer = application.offer!;
    offer.status = input.status!;
    if (input.packageAmount != null) offer.packageAmount = input.packageAmount;
    if (input.currency != null) offer.currency = clean(input.currency, 10);
    if (input.offerDate != null) offer.offerDate = nullableDate(input.offerDate, "Offer date");
    if (input.status === "JOINED") {
      offer.joinedAt = nullableDate(input.joinedAt, "Joining date") ?? offer.joinedAt ?? localDateNow(scope.timezone);
      application.stage = "JOINED";
      await recordStage(application, "JOINED", "Offer marked as joined", scope, session);
    } else {
      offer.joinedAt = null;
    }
    if (input.notes != null) offer.notes = clean(input.notes, 500);
    offer.updatedAt = new Date();
    await application.save({ session });
    result = { app: application.toObject() as PlacementApplicationDoc, offer: { ...offer } };
    await recordInstitutionEvent({
      actorUserId: scope.userId, actorRole: scope.designation, actorEmail: scope.user.email,
      action: "PLACEMENT_OFFER_UPDATE", targetType: "PLACEMENT_OFFER", targetId: String(offerId),
      institutionId: scope.institutionId, details: `status=${input.status}`, session,
    });
  });
  return offerResponse(result.app, result.offer);
}

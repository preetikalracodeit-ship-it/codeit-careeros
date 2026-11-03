import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { sendCsv, toCsv } from "../../lib/csv.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../lib/validators.js";
import { z } from "zod";
import { ENROLLMENT_STATUSES } from "../../models/StudentEnrollment.js";
import { COMPANY_STATUSES } from "../../models/Company.js";
import { EMPLOYMENT_TYPES, JOB_STATUSES } from "../../models/JobOpening.js";
import { DRIVE_STATUSES } from "../../models/PlacementDrive.js";
import { APPLICATION_STAGES, OFFER_STATUSES } from "../../models/PlacementApplication.js";
import { collegeMe, listCollegeMembers, updateCollegeMembership } from "./college.service.js";
import { getCollegeDashboard } from "./collegeDashboard.service.js";
import {
  exportCollegeCsv,
  exportStudentRoster,
  generateCohortPdf,
  generateStudentPdf,
} from "./collegeReports.service.js";
import {
  requireCollegeScope,
  requireExport,
  requireManageStaff,
  requireManageStudents,
  requireImport,
  requirePlacementReports,
  requireReports,
  type CollegeScope,
} from "./collegeScope.service.js";
import {
  getPlacementAnalytics,
  exportPlacementAnalyticsCsv,
} from "./placementAnalytics.service.js";
import {
  academicStructure,
  createAcademicYear,
  createBatch,
  createDepartment,
  createProgram,
  createSection,
  updateAcademicYear,
  updateBatch,
  updateDepartment,
  updateInstitutionAsCollege,
  updateProgram,
  updateSection,
} from "./academicStructure.service.js";
import {
  getStudentDetail,
  listBelowSkillTarget,
  listStudents,
  updateEnrollmentStatus,
  type StudentFilter,
} from "./studentEnrollment.service.js";
import { commitStudentImport, previewStudentImport } from "./collegeImport.service.js";
import {
  createApplicationOffer,
  createDriveApplication,
  createPlacementCompany,
  createPlacementDrive,
  createPlacementJob,
  getPlacementDriveDetail,
  listEligibleDriveStudents,
  listPlacementCompanies,
  listPlacementDrives,
  listPlacementJobs,
  updateApplicationOffer,
  updateDriveApplication,
  updatePlacementCompany,
  updatePlacementDrive,
  updatePlacementJob,
} from "./collegePlacement.service.js";

export const collegeRouter = Router();
collegeRouter.use(requireAuth);
const studentImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

function numericId(value: string, label: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw AppError.notFound(`${label} not found`);
  return id;
}

type Handler = (scope: CollegeScope, req: Request) => Promise<unknown>;

const optionalBoolean = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().optional());

const optionalPositiveId = z.coerce.number().int().positive().safe().optional();
const studentFilterSchema = z.object({
  search: z.string().max(200).optional(),
  academicYearId: optionalPositiveId,
  departmentId: optionalPositiveId,
  programId: optionalPositiveId,
  batchId: optionalPositiveId,
  sectionId: optionalPositiveId,
  semester: z.coerce.number().int().min(1).max(20).optional(),
  status: z.enum(ENROLLMENT_STATUSES).optional(),
  assessmentCompleted: optionalBoolean,
  readinessEvaluated: optionalBoolean,
  assessmentDateFrom: z.iso.date().optional(),
  assessmentDateTo: z.iso.date().optional(),
});
const studentPageQuerySchema = studentFilterSchema.extend({
  needsPreparation: optionalBoolean,
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.string().max(40).default("fullName"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});
const skillGapQuerySchema = studentFilterSchema.extend({
  skillId: z.coerce.number().int().positive().safe(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(25),
});
const enrollmentStatusSchema = z.object({ status: z.enum(ENROLLMENT_STATUSES) });
const placementCompanySchema = z.object({
  name: z.string().max(180).optional(),
  industry: z.string().max(120).nullable().optional(),
  sector: z.string().max(120).nullable().optional(),
  website: z.string().max(250).nullable().optional(),
  contactName: z.string().max(120).nullable().optional(),
  contactEmail: z.string().max(190).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  recruitmentStatus: z.enum(COMPANY_STATUSES).optional(),
  source: z.string().max(120).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});
const placementJobSchema = z.object({
  companyId: optionalPositiveId,
  title: z.string().max(180).optional(),
  description: z.string().max(4000).nullable().optional(),
  requiredSkills: z.string().max(1000).nullable().optional(),
  location: z.string().max(160).nullable().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullable().optional(),
  eligibilityCriteria: z.string().max(2000).nullable().optional(),
  salaryMin: z.number().finite().nonnegative().nullable().optional(),
  salaryMax: z.number().finite().nonnegative().nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  applicationDeadline: z.iso.date().nullable().optional(),
  status: z.enum(JOB_STATUSES).optional(),
});
const placementDriveSchema = z.object({
  companyId: optionalPositiveId,
  jobId: optionalPositiveId,
  name: z.string().max(180).optional(),
  registrationStart: z.iso.date().nullable().optional(),
  registrationEnd: z.iso.date().nullable().optional(),
  driveDate: z.iso.date().nullable().optional(),
  eligibilityCriteria: z.string().max(2000).nullable().optional(),
  eligibleDepartmentId: optionalPositiveId.nullable(),
  eligibleProgramId: optionalPositiveId.nullable(),
  eligibleBatchId: optionalPositiveId.nullable(),
  eligibleGraduationYear: z.number().int().nullable().optional(),
  minimumReadinessPercent: z.number().int().nullable().optional(),
  status: z.enum(DRIVE_STATUSES).optional(),
});
const placementApplicationSchema = z.object({
  enrollmentId: optionalPositiveId,
  override: z.boolean().optional(),
  overrideReason: z.string().max(500).nullable().optional(),
});
const applicationStageSchema = z.object({
  stage: z.enum(APPLICATION_STAGES),
  note: z.string().max(500).nullable().optional(),
});
const placementOfferSchema = z.object({
  packageAmount: z.number().finite().nonnegative().nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  offerDate: z.iso.date().nullable().optional(),
  joinedAt: z.iso.date().nullable().optional(),
  status: z.enum(OFFER_STATUSES).optional(),
  notes: z.string().max(500).nullable().optional(),
});
const placementOfferUpdateSchema = placementOfferSchema.extend({
  status: z.enum(OFFER_STATUSES),
});

function studentFilter(query: z.infer<typeof studentFilterSchema>): StudentFilter {
  return query;
}

function route(handler: Handler, options: { message?: string } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = await requireCollegeScope(req.user!.id);
      const data = await handler(scope, req);
      sendSuccess(res, data, options);
    } catch (error) {
      next(error);
    }
  };
}

collegeRouter.get("/me", route(async (scope) => collegeMe(scope.membership, scope.institution, scope.user)));

collegeRouter.get("/structure", route(async (scope) => academicStructure(scope)));
collegeRouter.get(
  "/dashboard",
  route(async (scope, req) => getCollegeDashboard(scope, studentFilter(validate(studentFilterSchema, req.query)))),
);
collegeRouter.get("/reports/cohort.pdf", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    requireReports(scope);
    const query = validate(studentFilterSchema, req.query);
    const report = await generateCohortPdf(scope, studentFilter(query));
    res.status(200)
      .type("application/pdf")
      .set("Content-Disposition", `attachment; filename="${report.filename}"`)
      .set("Content-Length", String(report.bytes.length))
      .send(report.bytes);
  } catch (error) {
    next(error);
  }
});
collegeRouter.get("/reports/export.csv", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    requireReports(scope);
    const query = validate(studentFilterSchema.extend({ type: z.string().max(80) }), req.query);
    const report = await exportCollegeCsv(scope, studentFilter(query), query.type);
    sendCsv(res, report.filename, report.bytes);
  } catch (error) {
    next(error);
  }
});

collegeRouter.get(
  "/students",
  route(async (scope, req) => {
    const query = validate(studentPageQuerySchema, req.query);
    return listStudents(
      scope,
      studentFilter(query),
      query.page,
      query.size,
      query.sortBy,
      query.sortDir,
    );
  }),
);
collegeRouter.get(
  "/students/skill-gap",
  route(async (scope, req) => {
    const query = validate(skillGapQuerySchema, req.query);
    return listBelowSkillTarget(scope, studentFilter(query), query.skillId, query.page, query.size);
  }),
);
collegeRouter.get("/students/export.csv", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    const query = validate(studentFilterSchema, req.query);
    const report = await exportStudentRoster(scope, studentFilter(query));
    sendCsv(res, report.filename, report.bytes);
  } catch (error) {
    next(error);
  }
});
collegeRouter.get("/students/import/template.csv", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    requireImport(scope);
    sendCsv(res, "careeros-student-import-template.csv", toCsv([[
      "full_name",
      "email",
      "roll_number",
      "department_code",
      "program_code",
      "batch_label",
      "mobile",
      "section_name",
      "academic_year_label",
    ]]));
  } catch (error) {
    next(error);
  }
});
collegeRouter.post(
  "/students/import/preview",
  studentImportUpload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = await requireCollegeScope(req.user!.id);
      sendSuccess(res, await previewStudentImport(scope, req.file));
    } catch (error) {
      next(error);
    }
  },
);
collegeRouter.post(
  "/students/import/:jobId/commit",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = await requireCollegeScope(req.user!.id);
      const jobId = numericId(String(req.params.jobId), "Import job");
      sendSuccess(res, await commitStudentImport(scope, jobId), { message: "Import committed" });
    } catch (error) {
      next(error);
    }
  },
);
collegeRouter.get(
  "/students/:id/report.pdf",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = await requireCollegeScope(req.user!.id);
      requireReports(scope);
      const report = await generateStudentPdf(scope, numericId(String(req.params.id), "Student"));
      res.status(200)
        .type("application/pdf")
        .set("Content-Disposition", `attachment; filename="${report.filename}"`)
        .set("Content-Length", String(report.bytes.length))
        .send(report.bytes);
    } catch (error) {
      next(error);
    }
  },
);
collegeRouter.get(
  "/students/:id",
  route(async (scope, req) => getStudentDetail(scope, numericId(String(req.params.id), "Student"))),
);
collegeRouter.patch(
  "/students/:id/status",
  route(async (scope, req) => {
    requireManageStudents(scope);
    const input = validate(enrollmentStatusSchema, req.body);
    return updateEnrollmentStatus(scope, numericId(String(req.params.id), "Student"), input.status);
  }, { message: "Enrollment status updated" }),
);

collegeRouter.put(
  "/institution",
  route(async (scope, req) => updateInstitutionAsCollege(scope, req.body), { message: "Institution updated" }),
);

collegeRouter.post(
  "/departments",
  route(async (scope, req) => createDepartment(scope, req.body), { message: "Department created" }),
);
collegeRouter.put(
  "/departments/:id",
  route(async (scope, req) => updateDepartment(scope, numericId(String(req.params.id), "Department"), req.body), {
    message: "Department updated",
  }),
);
collegeRouter.post(
  "/programs",
  route(async (scope, req) => createProgram(scope, req.body), { message: "Program created" }),
);
collegeRouter.put(
  "/programs/:id",
  route(async (scope, req) => updateProgram(scope, numericId(String(req.params.id), "Program"), req.body), {
    message: "Program updated",
  }),
);
collegeRouter.post(
  "/academic-years",
  route(async (scope, req) => createAcademicYear(scope, req.body), { message: "Academic year created" }),
);
collegeRouter.put(
  "/academic-years/:id",
  route(async (scope, req) => updateAcademicYear(scope, numericId(String(req.params.id), "Academic year"), req.body), {
    message: "Academic year updated",
  }),
);
collegeRouter.post(
  "/batches",
  route(async (scope, req) => createBatch(scope, req.body), { message: "Batch created" }),
);
collegeRouter.put(
  "/batches/:id",
  route(async (scope, req) => updateBatch(scope, numericId(String(req.params.id), "Batch"), req.body), {
    message: "Batch updated",
  }),
);
collegeRouter.post(
  "/sections",
  route(async (scope, req) => createSection(scope, req.body), { message: "Section created" }),
);
collegeRouter.put(
  "/sections/:id",
  route(async (scope, req) => updateSection(scope, numericId(String(req.params.id), "Section"), req.body), {
    message: "Section updated",
  }),
);

collegeRouter.get(
  "/staff/members",
  route(async (scope) => {
    requireManageStaff(scope);
    return listCollegeMembers(scope.institutionId);
  }),
);
collegeRouter.patch(
  "/staff/members/:id",
  route(async (scope, req) => {
    requireManageStaff(scope);
    return updateCollegeMembership(
      scope.institutionId,
      scope.userId,
      numericId(String(req.params.id), "Membership"),
      req.body ?? {},
    );
  }, { message: "Membership updated" }),
);

collegeRouter.get("/placement/companies", route(async (scope) => listPlacementCompanies(scope)));
collegeRouter.post(
  "/placement/companies",
  route(async (scope, req) => createPlacementCompany(scope, validate(placementCompanySchema, req.body)), {
    message: "Company created",
  }),
);
collegeRouter.put(
  "/placement/companies/:id",
  route(async (scope, req) =>
    updatePlacementCompany(scope, numericId(String(req.params.id), "Company"), validate(placementCompanySchema, req.body)), {
    message: "Company updated",
  }),
);
collegeRouter.get(
  "/placement/jobs",
  route(async (scope, req) => {
    const query = validate(z.object({
      companyId: optionalPositiveId,
      status: z.enum(JOB_STATUSES).optional(),
    }), req.query);
    return listPlacementJobs(scope, query);
  }),
);
collegeRouter.post(
  "/placement/jobs",
  route(async (scope, req) => createPlacementJob(scope, validate(placementJobSchema, req.body)), {
    message: "Job opening created",
  }),
);
collegeRouter.put(
  "/placement/jobs/:id",
  route(async (scope, req) =>
    updatePlacementJob(scope, numericId(String(req.params.id), "Job opening"), validate(placementJobSchema, req.body)), {
    message: "Job opening updated",
  }),
);
collegeRouter.get(
  "/placement/drives",
  route(async (scope, req) => {
    const query = validate(z.object({ status: z.enum(DRIVE_STATUSES).optional() }), req.query);
    return listPlacementDrives(scope, query.status);
  }),
);
collegeRouter.post(
  "/placement/drives",
  route(async (scope, req) => createPlacementDrive(scope, validate(placementDriveSchema, req.body)), {
    message: "Placement drive created",
  }),
);
collegeRouter.get(
  "/placement/drives/:id/eligible-students",
  route(async (scope, req) =>
    listEligibleDriveStudents(scope, numericId(String(req.params.id), "Placement drive"))),
);
collegeRouter.get(
  "/placement/drives/:id",
  route(async (scope, req) =>
    getPlacementDriveDetail(scope, numericId(String(req.params.id), "Placement drive"))),
);
collegeRouter.put(
  "/placement/drives/:id",
  route(async (scope, req) =>
    updatePlacementDrive(scope, numericId(String(req.params.id), "Placement drive"), validate(placementDriveSchema, req.body)), {
    message: "Placement drive updated",
  }),
);
collegeRouter.post(
  "/placement/drives/:id/applications",
  route(async (scope, req) =>
    createDriveApplication(
      scope,
      numericId(String(req.params.id), "Placement drive"),
      validate(placementApplicationSchema, req.body),
    ), {
    message: "Application registered",
  }),
);
collegeRouter.patch(
  "/placement/applications/:id",
  route(async (scope, req) =>
    updateDriveApplication(
      scope,
      numericId(String(req.params.id), "Application"),
      validate(applicationStageSchema, req.body),
    ), {
    message: "Application updated",
  }),
);
collegeRouter.post(
  "/placement/applications/:id/offer",
  route(async (scope, req) =>
    createApplicationOffer(
      scope,
      numericId(String(req.params.id), "Application"),
      validate(placementOfferSchema, req.body),
    ), {
    message: "Offer recorded",
  }),
);
collegeRouter.patch(
  "/placement/offers/:id",
  route(async (scope, req) =>
    updateApplicationOffer(
      scope,
      numericId(String(req.params.id), "Offer"),
      validate(placementOfferUpdateSchema, req.body),
    ), {
    message: "Offer updated",
  }),
);

collegeRouter.get(
  "/placement/analytics",
  route(async (scope, req) => {
    requirePlacementReports(scope);
    const query = validate(studentFilterSchema, req.query);
    return getPlacementAnalytics(scope, studentFilter(query));
  }),
);

collegeRouter.get("/placement/analytics/export.csv", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await requireCollegeScope(req.user!.id);
    requirePlacementReports(scope);
    requireExport(scope);
    const query = validate(studentFilterSchema.extend({ type: z.string().max(80) }), req.query);
    const report = await exportPlacementAnalyticsCsv(scope, studentFilter(query), query.type);
    sendCsv(res, report.filename, report.bytes);
  } catch (error) {
    next(error);
  }
});

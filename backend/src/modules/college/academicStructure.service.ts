import { recordInstitutionEvent } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";
import { getNextSequence } from "../../models/Counter.js";
import { AcademicYear, type AcademicYearDoc } from "../../models/AcademicYear.js";
import { Batch, type BatchDoc } from "../../models/Batch.js";
import { Department, type DepartmentDoc } from "../../models/Department.js";
import { Institution, type InstitutionDoc } from "../../models/Institution.js";
import { Program, type ProgramDoc } from "../../models/Program.js";
import { Section, type SectionDoc } from "../../models/Section.js";
import { requireManageStructure, type CollegeScope } from "./collegeScope.service.js";

const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;

export interface InstitutionInput {
  code?: string;
  name?: string;
  timezone?: string | null;
  contactEmail?: string | null;
  status?: "ACTIVE" | "INACTIVE";
}
export interface DepartmentInput {
  code?: string;
  name?: string;
  status?: "ACTIVE" | "INACTIVE";
}
export interface ProgramInput {
  departmentId?: number | null;
  code?: string;
  name?: string;
  degreeType?: string | null;
  durationYears?: number | null;
  status?: "ACTIVE" | "INACTIVE";
}
export interface AcademicYearInput {
  label?: string;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
}
export interface BatchInput {
  programId?: number | null;
  academicYearId?: number | null;
  label?: string;
  graduationYear?: number | null;
  status?: "ACTIVE" | "INACTIVE";
}
export interface SectionInput {
  batchId?: number | null;
  name?: string;
  status?: "ACTIVE" | "INACTIVE";
}

function requireCode(raw: string | undefined, label: string): string {
  const value = raw?.trim() ?? "";
  if (!CODE.test(value)) {
    throw AppError.badRequest(`${label} must be 2–40 characters using letters, digits, dot, underscore or hyphen`);
  }
  return value;
}

function requireText(raw: string | undefined, label: string, max: number): string {
  const value = raw?.trim() ?? "";
  if (!value) throw AppError.badRequest(`${label} is required`);
  if (value.length > max) throw AppError.badRequest(`${label} must be at most ${max} characters`);
  return value;
}

function trimToNull(raw: string | null | undefined, max: number): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if (value.length > max) throw AppError.badRequest(`Value must be at most ${max} characters`);
  return value;
}

function normalizeEmail(raw: string | null | undefined): string | null {
  const value = raw?.trim().toLowerCase() ?? "";
  if (!value) return null;
  if (value.length > 190 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    throw AppError.badRequest("Contact email is not valid");
  }
  return value;
}

function validDuration(years: number | null | undefined): number | null {
  if (years == null) return null;
  if (years < 1 || years > 10) throw AppError.badRequest("Duration must be between 1 and 10 years");
  return years;
}

function validYear(year: number | null | undefined): number | null {
  if (year == null) return null;
  const current = new Date().getUTCFullYear();
  if (year < 1900 || year > current + 20) throw AppError.badRequest("Graduation year is not plausible");
  return year;
}

function validateDates(start: string | null | undefined, end: string | null | undefined): void {
  if (start && end && end <= start) throw AppError.badRequest("Academic year end date must be after its start date");
}

export function institutionResponse(institution: InstitutionDoc) {
  return {
    id: institution._id,
    code: institution.code,
    name: institution.name,
    status: institution.status,
    timezone: institution.timezone ?? null,
    contactEmail: institution.contactEmail ?? null,
    createdAt: institution.createdAt,
    updatedAt: institution.updatedAt,
  };
}

export function departmentResponse(department: DepartmentDoc) {
  return {
    id: department._id,
    institutionId: department.institutionId,
    code: department.code,
    name: department.name,
    status: department.status,
    createdAt: department.createdAt,
  };
}

export async function programResponse(program: ProgramDoc) {
  const department = await Department.findById(program.departmentId).select("name").lean();
  return {
    id: program._id,
    institutionId: program.institutionId,
    departmentId: program.departmentId,
    departmentName: department?.name ?? null,
    code: program.code,
    name: program.name,
    degreeType: program.degreeType ?? null,
    durationYears: program.durationYears ?? null,
    status: program.status,
    createdAt: program.createdAt,
  };
}

export function academicYearResponse(year: AcademicYearDoc) {
  return {
    id: year._id,
    institutionId: year.institutionId,
    label: year.label,
    startDate: year.startDate ?? null,
    endDate: year.endDate ?? null,
    active: year.active,
    createdAt: year.createdAt,
  };
}

export async function batchResponse(batch: BatchDoc) {
  const program = await Program.findById(batch.programId).lean();
  const [department, year] = await Promise.all([
    program ? Department.findById(program.departmentId).select("name").lean() : null,
    AcademicYear.findById(batch.academicYearId).select("label").lean(),
  ]);
  return {
    id: batch._id,
    institutionId: program?.institutionId ?? null,
    programId: batch.programId,
    programName: program?.name ?? null,
    departmentId: program?.departmentId ?? null,
    departmentName: department?.name ?? null,
    academicYearId: batch.academicYearId,
    academicYearLabel: year?.label ?? null,
    label: batch.label,
    graduationYear: batch.graduationYear ?? null,
    status: batch.status,
    createdAt: batch.createdAt,
  };
}

export async function sectionResponse(section: SectionDoc) {
  const batch = await Batch.findById(section.batchId).lean();
  const program = batch ? await Program.findById(batch.programId).select("name").lean() : null;
  return {
    id: section._id,
    batchId: section.batchId,
    batchLabel: batch?.label ?? null,
    programId: batch?.programId ?? null,
    programName: program?.name ?? null,
    name: section.name,
    status: section.status,
    createdAt: section.createdAt,
  };
}

export async function requireDepartment(institutionId: number, departmentId: number | null | undefined) {
  if (departmentId == null) throw AppError.notFound("Department not found in this institution");
  const department = await Department.findOne({ _id: departmentId, institutionId }).lean();
  if (!department) throw AppError.notFound("Department not found in this institution");
  return department;
}

export async function requireProgram(institutionId: number, programId: number | null | undefined) {
  if (programId == null) throw AppError.notFound("Program not found in this institution");
  const program = await Program.findOne({ _id: programId, institutionId }).lean();
  if (!program) throw AppError.notFound("Program not found in this institution");
  return program;
}

export async function requireBatch(institutionId: number, batchId: number | null | undefined) {
  if (batchId == null) throw AppError.notFound("Batch not found in this institution");
  const batch = await Batch.findById(batchId).lean();
  if (!batch || !(await Program.exists({ _id: batch.programId, institutionId }))) {
    throw AppError.notFound("Batch not found in this institution");
  }
  return batch;
}

export async function requireSection(institutionId: number, sectionId: number | null | undefined) {
  if (sectionId == null) throw AppError.notFound("Section not found in this institution");
  const section = await Section.findById(sectionId).lean();
  const batch = section ? await Batch.findById(section.batchId).lean() : null;
  if (!batch || !(await Program.exists({ _id: batch.programId, institutionId }))) {
    throw AppError.notFound("Section not found in this institution");
  }
  return section!;
}

export async function requireAcademicYear(institutionId: number, academicYearId: number | null | undefined) {
  if (academicYearId == null) throw AppError.notFound("Academic year not found in this institution");
  const year = await AcademicYear.findOne({ _id: academicYearId, institutionId }).lean();
  if (!year) throw AppError.notFound("Academic year not found in this institution");
  return year;
}

export async function academicStructure(scope: CollegeScope) {
  const institution = await Institution.findById(scope.institutionId).lean();
  if (!institution) throw AppError.notFound("Institution not found");
  const [departments, programs, years] = await Promise.all([
    Department.find({ institutionId: scope.institutionId }).sort({ name: 1, _id: 1 }).lean(),
    Program.find({ institutionId: scope.institutionId }).sort({ name: 1, _id: 1 }).lean(),
    AcademicYear.find({ institutionId: scope.institutionId }).sort({ startDate: -1, _id: -1 }).lean(),
  ]);
  const allBatches = await Batch.find({ programId: { $in: programs.map((program) => program._id) } })
    .sort({ label: 1, _id: 1 })
    .lean();
  const allSections = await Section.find({ batchId: { $in: allBatches.map((batch) => batch._id) } })
    .sort({ name: 1, _id: 1 })
    .lean();

  const visibleDepartments = await visibleDepartmentIds(scope, departments);
  const visiblePrograms = programs.filter((program) => visibleDepartments.has(program.departmentId));
  const visibleProgramIds = new Set(visiblePrograms.map((program) => program._id));
  const visibleBatches = allBatches.filter((batch) => visibleProgramIds.has(batch.programId));
  const visibleBatchIds = new Set(visibleBatches.map((batch) => batch._id));
  const visibleSections = allSections.filter((section) => visibleBatchIds.has(section.batchId));

  return {
    institution: institutionResponse(institution as InstitutionDoc),
    departments: departments.filter((department) => visibleDepartments.has(department._id)).map(departmentResponse),
    programs: await Promise.all(visiblePrograms.map(programResponse)),
    academicYears: years.map(academicYearResponse),
    batches: await Promise.all(visibleBatches.map(batchResponse)),
    sections: await Promise.all(visibleSections.map(sectionResponse)),
  };
}

async function visibleDepartmentIds(scope: CollegeScope, departments: DepartmentDoc[]) {
  switch (scope.scopeType) {
    case "INSTITUTION":
      return new Set(departments.map((department) => department._id));
    case "DEPARTMENT":
      return new Set(scope.scopeId == null ? [] : [scope.scopeId]);
    case "PROGRAM": {
      const program = await requireProgram(scope.institutionId, scope.scopeId);
      return new Set([program.departmentId]);
    }
    case "BATCH": {
      const batch = await requireBatch(scope.institutionId, scope.scopeId);
      const program = await requireProgram(scope.institutionId, batch.programId);
      return new Set([program.departmentId]);
    }
    case "SECTION": {
      const section = await requireSection(scope.institutionId, scope.scopeId);
      const batch = await requireBatch(scope.institutionId, section.batchId);
      const program = await requireProgram(scope.institutionId, batch.programId);
      return new Set([program.departmentId]);
    }
    default:
      return new Set<number>();
  }
}

async function audit(scope: CollegeScope, action: string, targetType: string, targetId: string, details?: string) {
  await recordInstitutionEvent({
    actorUserId: scope.userId,
    actorRole: scope.designation,
    action,
    targetType,
    targetId,
    institutionId: scope.institutionId,
    scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
    details,
  });
}

export async function updateInstitutionAsCollege(scope: CollegeScope, input: InstitutionInput) {
  requireManageStructure(scope);
  const institution = await Institution.findById(scope.institutionId);
  if (!institution) throw AppError.notFound("Institution not found");
  institution.name = requireText(input.name, "Institution name", 160);
  institution.timezone = trimToNull(input.timezone, 60);
  institution.contactEmail = normalizeEmail(input.contactEmail);
  await institution.save();
  await audit(scope, "INSTITUTION_UPDATE", "INSTITUTION", String(institution._id), `name=${institution.name}`);
  return institutionResponse(institution.toObject() as InstitutionDoc);
}

export async function createDepartment(scope: CollegeScope, input: DepartmentInput) {
  requireManageStructure(scope);
  const code = requireCode(input.code, "Department code");
  if (await Department.findOne({ institutionId: scope.institutionId, code }).collation({ locale: "en", strength: 2 }).lean()) {
    throw AppError.conflict("A department with this code already exists in the institution");
  }
  const [department] = await Department.create([{
    _id: await getNextSequence("departments"),
    institutionId: scope.institutionId,
    code: code.toUpperCase(),
    name: requireText(input.name, "Department name", 160),
    status: input.status ?? "ACTIVE",
  }]);
  await audit(scope, "DEPARTMENT_CREATE", "DEPARTMENT", String(department._id), `code=${department.code}`);
  return departmentResponse(department.toObject() as DepartmentDoc);
}

export async function updateDepartment(scope: CollegeScope, id: number, input: DepartmentInput) {
  requireManageStructure(scope);
  const department = await Department.findOne({ _id: id, institutionId: scope.institutionId });
  if (!department) throw AppError.notFound("Department not found in this institution");
  const code = requireCode(input.code, "Department code");
  const other = await Department.findOne({ institutionId: scope.institutionId, code })
    .collation({ locale: "en", strength: 2 })
    .lean();
  if (other && other._id !== id) throw AppError.conflict("A department with this code already exists in the institution");
  department.code = code.toUpperCase();
  department.name = requireText(input.name, "Department name", 160);
  if (input.status) department.status = input.status;
  await department.save();
  await audit(scope, "DEPARTMENT_UPDATE", "DEPARTMENT", String(id), `code=${department.code}`);
  return departmentResponse(department.toObject() as DepartmentDoc);
}

export async function createProgram(scope: CollegeScope, input: ProgramInput) {
  requireManageStructure(scope);
  if (input.departmentId == null) throw AppError.badRequest("Department is required");
  const department = await requireDepartment(scope.institutionId, input.departmentId);
  const code = requireCode(input.code, "Program code");
  if (await Program.findOne({ institutionId: scope.institutionId, code }).collation({ locale: "en", strength: 2 }).lean()) {
    throw AppError.conflict("A program with this code already exists in the institution");
  }
  const [program] = await Program.create([{
    _id: await getNextSequence("programs"),
    institutionId: scope.institutionId,
    departmentId: department._id,
    code: code.toUpperCase(),
    name: requireText(input.name, "Program name", 160),
    degreeType: trimToNull(input.degreeType, 60),
    durationYears: validDuration(input.durationYears),
    status: input.status ?? "ACTIVE",
  }]);
  await audit(scope, "PROGRAM_CREATE", "PROGRAM", String(program._id), `code=${program.code}`);
  return programResponse(program.toObject() as ProgramDoc);
}

export async function updateProgram(scope: CollegeScope, id: number, input: ProgramInput) {
  requireManageStructure(scope);
  const program = await Program.findOne({ _id: id, institutionId: scope.institutionId });
  if (!program) throw AppError.notFound("Program not found in this institution");
  if (input.departmentId == null) throw AppError.badRequest("Department is required");
  const department = await requireDepartment(scope.institutionId, input.departmentId);
  const code = requireCode(input.code, "Program code");
  const other = await Program.findOne({ institutionId: scope.institutionId, code })
    .collation({ locale: "en", strength: 2 })
    .lean();
  if (other && other._id !== id) throw AppError.conflict("A program with this code already exists in the institution");
  program.departmentId = department._id;
  program.code = code.toUpperCase();
  program.name = requireText(input.name, "Program name", 160);
  program.degreeType = trimToNull(input.degreeType, 60);
  program.durationYears = validDuration(input.durationYears);
  if (input.status) program.status = input.status;
  await program.save();
  await audit(scope, "PROGRAM_UPDATE", "PROGRAM", String(id), `code=${program.code}`);
  return programResponse(program.toObject() as ProgramDoc);
}

async function deactivateAcademicYears(institutionId: number) {
  await AcademicYear.updateMany({ institutionId, active: true }, { $set: { active: false } });
}

export async function createAcademicYear(scope: CollegeScope, input: AcademicYearInput) {
  requireManageStructure(scope);
  const label = requireText(input.label, "Academic year label", 40);
  if (await AcademicYear.findOne({ institutionId: scope.institutionId, label }).collation({ locale: "en", strength: 2 }).lean()) {
    throw AppError.conflict("This academic year already exists in the institution");
  }
  validateDates(input.startDate, input.endDate);
  const active = input.active === true;
  if (active) await deactivateAcademicYears(scope.institutionId);
  const [year] = await AcademicYear.create([{
    _id: await getNextSequence("academic_years"),
    institutionId: scope.institutionId,
    label,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    active,
  }]);
  await audit(scope, "ACADEMIC_YEAR_CREATE", "ACADEMIC_YEAR", String(year._id), `label=${label}`);
  return academicYearResponse(year.toObject() as AcademicYearDoc);
}

export async function updateAcademicYear(scope: CollegeScope, id: number, input: AcademicYearInput) {
  requireManageStructure(scope);
  const year = await AcademicYear.findOne({ _id: id, institutionId: scope.institutionId });
  if (!year) throw AppError.notFound("Academic year not found in this institution");
  const label = requireText(input.label, "Academic year label", 40);
  const other = await AcademicYear.findOne({ institutionId: scope.institutionId, label })
    .collation({ locale: "en", strength: 2 })
    .lean();
  if (other && other._id !== id) throw AppError.conflict("This academic year already exists in the institution");
  validateDates(input.startDate, input.endDate);
  const active = input.active === true;
  if (active) await deactivateAcademicYears(scope.institutionId);
  year.label = label;
  year.startDate = input.startDate ?? null;
  year.endDate = input.endDate ?? null;
  year.active = active;
  await year.save();
  await audit(scope, "ACADEMIC_YEAR_UPDATE", "ACADEMIC_YEAR", String(id), `label=${label}`);
  return academicYearResponse(year.toObject() as AcademicYearDoc);
}

export async function createBatch(scope: CollegeScope, input: BatchInput) {
  requireManageStructure(scope);
  if (input.programId == null || input.academicYearId == null) {
    throw AppError.badRequest("Program and academic year are required");
  }
  const program = await requireProgram(scope.institutionId, input.programId);
  const year = await requireAcademicYear(scope.institutionId, input.academicYearId);
  const label = requireText(input.label, "Batch label", 40);
  if (await Batch.findOne({ programId: program._id, label }).collation({ locale: "en", strength: 2 }).lean()) {
    throw AppError.conflict("This batch label already exists for the program");
  }
  const [batch] = await Batch.create([{
    _id: await getNextSequence("batches"),
    programId: program._id,
    academicYearId: year._id,
    label,
    graduationYear: validYear(input.graduationYear),
    status: input.status ?? "ACTIVE",
  }]);
  await audit(scope, "BATCH_CREATE", "BATCH", String(batch._id), `label=${label}`);
  return batchResponse(batch.toObject() as BatchDoc);
}

export async function updateBatch(scope: CollegeScope, id: number, input: BatchInput) {
  requireManageStructure(scope);
  const batch = await Batch.findById(id);
  if (!batch) throw AppError.notFound("Batch not found in this institution");
  await requireBatch(scope.institutionId, id);
  if (input.programId == null || input.academicYearId == null) {
    throw AppError.badRequest("Program and academic year are required");
  }
  const program = await requireProgram(scope.institutionId, input.programId);
  const year = await requireAcademicYear(scope.institutionId, input.academicYearId);
  const label = requireText(input.label, "Batch label", 40);
  const other = await Batch.findOne({ programId: program._id, label })
    .collation({ locale: "en", strength: 2 })
    .lean();
  if (other && other._id !== id) throw AppError.conflict("This batch label already exists for the program");
  batch.programId = program._id;
  batch.academicYearId = year._id;
  batch.label = label;
  batch.graduationYear = validYear(input.graduationYear);
  if (input.status) batch.status = input.status;
  await batch.save();
  await audit(scope, "BATCH_UPDATE", "BATCH", String(id), `label=${label}`);
  return batchResponse(batch.toObject() as BatchDoc);
}

export async function createSection(scope: CollegeScope, input: SectionInput) {
  requireManageStructure(scope);
  if (input.batchId == null) throw AppError.badRequest("Batch is required");
  const batch = await requireBatch(scope.institutionId, input.batchId);
  const name = requireText(input.name, "Section name", 40);
  if (await Section.findOne({ batchId: batch._id, name }).collation({ locale: "en", strength: 2 }).lean()) {
    throw AppError.conflict("This section already exists for the batch");
  }
  const [section] = await Section.create([{
    _id: await getNextSequence("sections"),
    batchId: batch._id,
    name,
    status: input.status ?? "ACTIVE",
  }]);
  await audit(scope, "SECTION_CREATE", "SECTION", String(section._id), `name=${name}`);
  return sectionResponse(section.toObject() as SectionDoc);
}

export async function updateSection(scope: CollegeScope, id: number, input: SectionInput) {
  requireManageStructure(scope);
  const section = await Section.findById(id);
  if (!section) throw AppError.notFound("Section not found in this institution");
  await requireSection(scope.institutionId, id);
  if (input.batchId == null) throw AppError.badRequest("Batch is required");
  const batch = await requireBatch(scope.institutionId, input.batchId);
  const name = requireText(input.name, "Section name", 40);
  const other = await Section.findOne({ batchId: batch._id, name })
    .collation({ locale: "en", strength: 2 })
    .lean();
  if (other && other._id !== id) throw AppError.conflict("This section already exists for the batch");
  section.batchId = batch._id;
  section.name = name;
  if (input.status) section.status = input.status;
  await section.save();
  await audit(scope, "SECTION_UPDATE", "SECTION", String(id), `name=${name}`);
  return sectionResponse(section.toObject() as SectionDoc);
}

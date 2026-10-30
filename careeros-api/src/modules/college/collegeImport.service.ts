import { createHash, randomUUID } from "node:crypto";
import type { Express } from "express";
import { AppError } from "../../lib/errors.js";
import { recordInstitutionEvent } from "../../lib/audit.js";
import { escapeCsvCell, parseCsv } from "../../lib/csv.js";
import { getNextSequence } from "../../models/Counter.js";
import { AcademicYear } from "../../models/AcademicYear.js";
import { Batch } from "../../models/Batch.js";
import { CsvImportJob, type CsvImportRowDoc } from "../../models/CsvImportJob.js";
import { Department } from "../../models/Department.js";
import { Institution } from "../../models/Institution.js";
import { Program } from "../../models/Program.js";
import { Section } from "../../models/Section.js";
import { StudentEnrollment } from "../../models/StudentEnrollment.js";
import { StudentProfile } from "../../models/StudentProfile.js";
import { User } from "../../models/User.js";
import { logger } from "../../lib/logger.js";
import { withTransaction } from "../../lib/db.js";
import { hashPassword } from "../../lib/password.js";
import { requireImport, type CollegeScope } from "./collegeScope.service.js";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 1000;
const PREVIEW_TTL_MINUTES = 30;
const DUPLICATE_WINDOW_HOURS = 24;
const REQUIRED_HEADERS = [
  "full_name",
  "email",
  "roll_number",
  "department_code",
  "program_code",
  "batch_label",
];
type ImportFields = Pick<
  CsvImportRowDoc,
  "fullName" | "email" | "mobile" | "rollNumber" | "departmentCode" |
  "programCode" | "batchLabel" | "sectionName" | "academicYearLabel"
>;

function normalizeEmail(value: string | null | undefined): string {
  const email = value?.trim().toLowerCase() ?? "";
  if (email.length > 190 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Email is not valid");
  }
  return email;
}

function required(value: string | null | undefined, label: string, max: number): string {
  const cleaned = value?.trim() ?? "";
  if (!cleaned) throw new Error(`${label} is required`);
  if (cleaned.length > max) throw new Error(`${label} must be at most ${max} characters`);
  return cleaned;
}

function truncate(value: string | undefined, max: number): string | null {
  const cleaned = value?.replace(/[\r\n\t]+/g, " ").trim() ?? "";
  return cleaned ? cleaned.slice(0, max) : null;
}

function headerIndex(values: string[]): Map<string, number> {
  const columns = new Map<string, number>();
  values.forEach((value, index) => {
    const key = value.trim().toLowerCase().replaceAll(" ", "_");
    if (columns.has(key)) throw AppError.badRequest(`CSV contains a duplicate column: ${key}`);
    columns.set(key, index);
  });
  for (const header of REQUIRED_HEADERS) {
    if (!columns.has(header)) throw AppError.badRequest(`Missing required CSV column: ${header}`);
  }
  return columns;
}

function cellValue(columns: Map<string, number>, row: string[], name: string): string | null {
  const index = columns.get(name);
  if (index == null || index >= row.length) return null;
  const value = row[index]?.trim() ?? "";
  return value || null;
}

function errorCsv(rows: CsvImportRowDoc[]): string {
  const output = [["row_number", "status", "message", "roll_number", "email"]];
  for (const row of rows) {
    if (row.status !== "REJECTED") continue;
    output.push([
      String(row.rowNumber),
      row.status,
      row.message ?? "",
      row.rollNumber ?? "",
      row.email ?? "",
    ]);
  }
  return output.map((line) => line.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n";
}

async function validateImportRow(
  institutionId: number,
  fields: ImportFields,
  seenEmails: Set<string>,
  seenRolls: Set<string>,
): Promise<{ fields: ImportFields; status: CsvImportRowDoc["status"]; message: string | null }> {
  const email = normalizeEmail(fields.email);
  const rollNumber = required(fields.rollNumber, "Roll number", 40);
  const fullName = required(fields.fullName, "Full name", 120);
  const row = { ...fields, email, rollNumber, fullName };
  if (seenEmails.has(email)) return { fields: row, status: "REJECTED", message: "Duplicate email within the file" };
  seenEmails.add(email);
  if (seenRolls.has(rollNumber.toUpperCase())) {
    return { fields: row, status: "REJECTED", message: "Duplicate roll number within the file" };
  }
  seenRolls.add(rollNumber.toUpperCase());

  const departmentCode = required(fields.departmentCode, "Department code", 40);
  const programCode = required(fields.programCode, "Program code", 40);
  const batchLabel = required(fields.batchLabel, "Batch label", 40);
  const department = await Department.findOne({ institutionId, code: departmentCode })
    .collation({ locale: "en", strength: 2 }).lean();
  if (!department) return { fields: row, status: "REJECTED", message: "Unknown department code" };
  const program = await Program.findOne({ institutionId, code: programCode })
    .collation({ locale: "en", strength: 2 }).lean();
  if (!program) return { fields: row, status: "REJECTED", message: "Unknown program code" };
  if (program.departmentId !== department._id) {
    return { fields: row, status: "REJECTED", message: "Program does not belong to the selected department" };
  }
  const batch = await Batch.findOne({ programId: program._id, label: batchLabel })
    .collation({ locale: "en", strength: 2 }).lean();
  if (!batch) return { fields: row, status: "REJECTED", message: "Unknown batch for the selected program" };

  if (fields.academicYearLabel) {
    const academicYearLabel = required(fields.academicYearLabel, "Academic year", 40);
    const academicYear = await AcademicYear.findOne({ institutionId, label: academicYearLabel })
      .collation({ locale: "en", strength: 2 }).lean();
    if (!academicYear) return { fields: row, status: "REJECTED", message: "Unknown academic year" };
    if (academicYear._id !== batch.academicYearId) {
      return { fields: row, status: "REJECTED", message: "Batch does not belong to the selected academic year" };
    }
  }
  if (fields.sectionName) {
    const sectionName = required(fields.sectionName, "Section name", 40);
    const section = await Section.findOne({ batchId: batch._id, name: sectionName })
      .collation({ locale: "en", strength: 2 }).lean();
    if (!section) return { fields: row, status: "REJECTED", message: "Unknown section for the selected batch" };
  }
  if (fields.mobile && !/^[0-9+\- ]{6,20}$/.test(fields.mobile.trim())) {
    return { fields: row, status: "REJECTED", message: "Mobile number is not valid" };
  }

  const existingUser = await User.findOne({ emailLower: email }).select("_id role").lean();
  const existingEnrollment = await StudentEnrollment.findOne({
    institutionId,
    rollNumber,
  }).collation({ locale: "en", strength: 2 }).lean();
  if (existingEnrollment) {
    if (existingUser?._id === (await StudentProfile.findById(existingEnrollment.studentProfileId).select("userId").lean())?.userId) {
      return { fields: row, status: "SKIPPED", message: "Student is already enrolled in the institution" };
    }
    return { fields: row, status: "REJECTED", message: "Roll number is already assigned in this institution" };
  }
  if (existingUser && existingUser.role !== "STUDENT") {
    return { fields: row, status: "REJECTED", message: "Email belongs to a staff or administrator account" };
  }
  if (existingUser) {
    const profile = await StudentProfile.findOne({ userId: existingUser._id }).select("_id").lean();
    if (profile && await StudentEnrollment.exists({ studentProfileId: profile._id, institutionId })) {
      return { fields: row, status: "SKIPPED", message: "Student is already enrolled in the institution" };
    }
    if (profile && await StudentEnrollment.exists({ studentProfileId: profile._id })) {
      return { fields: row, status: "REJECTED", message: "Student already belongs to another institution" };
    }
  }
  return {
    fields: {
      ...row,
      departmentCode,
      programCode,
      batchLabel,
      mobile: fields.mobile?.trim() || null,
    },
    status: "READY",
    message: null,
  };
}

export async function previewStudentImport(scope: CollegeScope, file: Express.Multer.File | undefined) {
  requireImport(scope);
  if (!file || file.size === 0) throw AppError.badRequest("A CSV file is required");
  if (!file.originalname.toLowerCase().endsWith(".csv")) {
    throw AppError.badRequest("Upload a file with the .csv extension");
  }
  const mediaType = file.mimetype.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType && ![
    "text/csv", "application/csv", "application/vnd.ms-excel", "application/octet-stream",
  ].includes(mediaType)) {
    throw AppError.badRequest("The uploaded file must be a CSV file");
  }
  if (file.size > MAX_FILE_BYTES) throw AppError.badRequest("CSV files are limited to 2 MB");
  if (!await Institution.exists({ _id: scope.institutionId })) {
    throw AppError.notFound("Institution not found");
  }
  const fileHash = createHash("sha256").update(file.buffer.toString("latin1")).digest("hex");
  const duplicate = await CsvImportJob.exists({
    institutionId: scope.institutionId,
    fileHash,
    status: "COMMITTED",
    createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000) },
  });
  if (duplicate) throw AppError.conflict("This exact file was already imported in the last 24 hours");

  let parsed: string[][];
  try {
    parsed = parseCsv(file.buffer.toString("utf8"));
  } catch (error) {
    if (error instanceof Error) throw AppError.badRequest(error.message);
    throw error;
  }
  if (parsed.length === 0) throw AppError.badRequest("The CSV file is empty");
  const columns = headerIndex(parsed[0]!);
  const dataRows = parsed.slice(1);
  if (dataRows.length > MAX_ROWS) throw AppError.badRequest(`A single import is limited to ${MAX_ROWS} rows`);

  const rows: CsvImportRowDoc[] = [];
  const seenEmails = new Set<string>();
  const seenRolls = new Set<string>();
  let readyRows = 0;
  let skippedRows = 0;
  let rejectedRows = 0;
  for (let index = 0; index < dataRows.length; index += 1) {
    const values = dataRows[index]!;
    const fields: ImportFields = {
      fullName: cellValue(columns, values, "full_name"),
      email: cellValue(columns, values, "email"),
      rollNumber: cellValue(columns, values, "roll_number"),
      departmentCode: cellValue(columns, values, "department_code"),
      programCode: cellValue(columns, values, "program_code"),
      batchLabel: cellValue(columns, values, "batch_label"),
      mobile: cellValue(columns, values, "mobile"),
      sectionName: cellValue(columns, values, "section_name"),
      academicYearLabel: cellValue(columns, values, "academic_year_label"),
    };
    let result: Awaited<ReturnType<typeof validateImportRow>>;
    try {
      result = await validateImportRow(scope.institutionId, fields, seenEmails, seenRolls);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid CSV row";
      result = { fields, status: "REJECTED", message: message.slice(0, 500) };
    }
    rows.push({
      rowNumber: index + 2,
      ...result.fields,
      status: result.status,
      message: result.message?.slice(0, 500) ?? null,
    });
    if (result.status === "READY") readyRows++;
    else if (result.status === "SKIPPED") skippedRows++;
    else if (result.status === "REJECTED") rejectedRows++;
  }

  const jobId = await getNextSequence("csv_import_jobs");
  const [job] = await CsvImportJob.create([{
    _id: jobId,
    institutionId: scope.institutionId,
    createdBy: scope.userId,
    status: "PREVIEW",
    originalFilename: truncate(file.originalname, 255),
    fileHash,
    totalRows: dataRows.length,
    skippedRows,
    rejectedRows,
    rows,
    expiresAt: new Date(Date.now() + PREVIEW_TTL_MINUTES * 60 * 1000),
  }]);
  const expiresAt = new Date(job.createdAt.getTime() + PREVIEW_TTL_MINUTES * 60 * 1000);
  await recordInstitutionEvent({
    actorUserId: scope.userId,
    actorRole: scope.designation,
    actorEmail: scope.user.email,
    action: "STUDENT_IMPORT_PREVIEW",
    targetType: "CSV_IMPORT_JOB",
    targetId: String(job._id),
    institutionId: scope.institutionId,
    scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
    details: `rows=${dataRows.length},ready=${readyRows},skipped=${skippedRows},rejected=${rejectedRows}`,
  });
  return {
    jobId: job._id,
    status: job.status,
    totalRows: dataRows.length,
    readyRows,
    skippedRows,
    rejectedRows,
    rows: rows.map(({ rowNumber, status, message, rollNumber, email }) => ({
      rowNumber, status, message, rollNumber: rollNumber ?? null, email: email ?? null,
    })),
    errorCsv: errorCsv(rows),
    expiresAt,
  };
}

async function processImportRow(jobId: number, rowNumber: number, institutionId: number) {
  let outcome: CsvImportRowDoc | undefined;
  await withTransaction(async (session) => {
    const job = await CsvImportJob.findOne({ _id: jobId, institutionId, status: "COMMITTING" })
      .session(session).lean();
    const row = job?.rows.find((item) => item.rowNumber === rowNumber);
    if (!job || !row) throw AppError.notFound("Import row not found");
    if (row.status !== "READY") {
      outcome = { ...row };
      return;
    }

    try {
      const email = normalizeEmail(row.email);
      const fullName = required(row.fullName, "Full name", 120);
      const rollNumber = required(row.rollNumber, "Roll number", 40);
      const departmentCode = required(row.departmentCode, "Department code", 40);
      const programCode = required(row.programCode, "Program code", 40);
      const batchLabel = required(row.batchLabel, "Batch label", 40);
      const department = await Department.findOne({ institutionId, code: departmentCode })
        .collation({ locale: "en", strength: 2 }).session(session).lean();
      if (!department) throw AppError.badRequest("Unknown department code");
      const program = await Program.findOne({ institutionId, code: programCode })
        .collation({ locale: "en", strength: 2 }).session(session).lean();
      if (!program) throw AppError.badRequest(`Unknown program code: ${programCode}`);
      if (program.departmentId !== department._id) {
        throw AppError.badRequest("Program does not belong to the selected department");
      }
      const batch = await Batch.findOne({ programId: program._id, label: batchLabel })
        .collation({ locale: "en", strength: 2 }).session(session).lean();
      if (!batch) throw AppError.badRequest(`Unknown batch: ${batchLabel}`);
      if (row.academicYearLabel) {
        const academicYear = await AcademicYear.findOne({
          institutionId,
          label: required(row.academicYearLabel, "Academic year", 40),
        }).collation({ locale: "en", strength: 2 }).session(session).lean();
        if (!academicYear) throw AppError.badRequest("Unknown academic year");
        if (academicYear._id !== batch.academicYearId) {
          throw AppError.badRequest("Batch does not belong to the selected academic year");
        }
      }

      let sectionId: number | null = null;
      if (row.sectionName) {
        const section = await Section.findOne({ batchId: batch._id, name: row.sectionName })
          .collation({ locale: "en", strength: 2 }).session(session).lean();
        if (!section) throw AppError.badRequest(`Unknown section: ${row.sectionName}`);
        sectionId = section._id;
      }
      const mobile = row.mobile?.trim() || null;
      if (mobile && !/^[0-9+\- ]{6,20}$/.test(mobile)) {
        throw AppError.badRequest("Mobile number is not valid");
      }

      const existingUser = await User.findOne({ emailLower: email }).session(session);
      if (existingUser && existingUser.role !== "STUDENT") {
        throw AppError.badRequest("This email belongs to a staff or administrator account");
      }
      if (existingUser && existingUser.status !== "ACTIVE") {
        throw AppError.badRequest("This student account is not active");
      }
      const existingEnrollment = await StudentEnrollment.findOne({
        institutionId,
        rollNumber,
      }).collation({ locale: "en", strength: 2 }).session(session).lean();
      if (existingEnrollment) {
        const profile = await StudentProfile.findById(existingEnrollment.studentProfileId).session(session).lean();
        if (existingUser && profile?.userId === existingUser._id) {
          row.status = "SKIPPED";
          row.message = "This student is already enrolled in the institution";
        } else {
          throw AppError.badRequest("Roll number is already assigned in this institution");
        }
      } else if (existingUser) {
        let profile = await StudentProfile.findOne({ userId: existingUser._id }).session(session);
        if (!profile) {
          const profileId = await getNextSequence("student_profiles", session);
          [profile] = await StudentProfile.create([{
            _id: profileId,
            userId: existingUser._id,
            studentId: `STU${String(existingUser._id).padStart(6, "0")}`,
            fullName,
            mobile,
            semester: 1,
          }], { session });
        }
        if (await StudentEnrollment.exists({ studentProfileId: profile._id, institutionId }).session(session)) {
          row.status = "SKIPPED";
          row.message = "This student is already enrolled in the institution";
        } else if (await StudentEnrollment.exists({ studentProfileId: profile._id }).session(session)) {
          throw AppError.badRequest("This student already belongs to another institution");
        } else {
          const enrollmentId = await getNextSequence("student_enrollments", session);
          await StudentEnrollment.create([{
            _id: enrollmentId,
            studentProfileId: profile._id,
            institutionId,
            departmentId: department._id,
            programId: program._id,
            batchId: batch._id,
            sectionId,
            rollNumber,
            status: "ACTIVE",
          }], { session });
          row.status = "LINKED";
          row.message = "Linked existing student account";
        }
      } else {
        const userId = await getNextSequence("users", session);
        const [createdUser] = await User.create([{
          _id: userId,
          email,
          emailLower: email,
          passwordHash: await hashPassword(`${randomUUID()}-unusable-import-password`),
          fullName,
          role: "STUDENT",
          status: "ACTIVE",
        }], { session });
        const profileId = await getNextSequence("student_profiles", session);
        const [profile] = await StudentProfile.create([{
          _id: profileId,
          userId: createdUser!._id,
          studentId: `STU${String(createdUser!._id).padStart(6, "0")}`,
          fullName,
          mobile,
          semester: 1,
        }], { session });
        const enrollmentId = await getNextSequence("student_enrollments", session);
        await StudentEnrollment.create([{
          _id: enrollmentId,
          studentProfileId: profile!._id,
          institutionId,
          departmentId: department._id,
          programId: program._id,
          batchId: batch._id,
          sectionId,
          rollNumber,
          status: "ACTIVE",
        }], { session });
        row.status = "CREATED";
        row.message = "Student account and enrollment created. This import did not issue a credential or activation link; verify student access through an approved sign-in flow.";
      }
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      row.status = "REJECTED";
      row.message = error.message.slice(0, 500);
    }
    await CsvImportJob.updateOne(
      { _id: jobId, institutionId, status: "COMMITTING", "rows.rowNumber": rowNumber },
      { $set: { "rows.$.status": row.status, "rows.$.message": row.message ?? null } },
      { session },
    );
    outcome = { ...row };
  });
  if (!outcome) throw AppError.internal("Could not import this row");
  return outcome;
}

export async function commitStudentImport(scope: CollegeScope, jobId: number) {
  requireImport(scope);
  const existing = await CsvImportJob.findOne({ _id: jobId, institutionId: scope.institutionId });
  if (!existing) throw AppError.notFound("Import job not found");
  if (existing.createdBy !== scope.userId) {
    throw AppError.forbidden("Only the administrator who previewed this file can commit it");
  }
  const now = new Date();
  if (existing.status === "PREVIEW" && existing.expiresAt && existing.expiresAt < now) {
    await CsvImportJob.updateOne(
      { _id: jobId, status: "PREVIEW" },
      { $set: { status: "FAILED", rows: [], expiresAt: null } },
    );
    throw AppError.badRequest("This import preview has expired; upload the file again");
  }
  const job = await CsvImportJob.findOneAndUpdate(
    { _id: jobId, institutionId: scope.institutionId, createdBy: scope.userId, status: "PREVIEW" },
    { $set: { status: "COMMITTING" } },
    { returnDocument: "after" },
  ).lean();
  if (!job) throw AppError.conflict("This import job is not awaiting commit");

  const outcomes: CsvImportRowDoc[] = [];
  try {
    for (const row of job.rows) {
      if (row.status === "READY") {
        try {
          outcomes.push(await processImportRow(jobId, row.rowNumber, scope.institutionId));
        } catch (error) {
          logger.error({ err: error, jobId, rowNumber: row.rowNumber }, "Student CSV row import failed");
          const failed: CsvImportRowDoc = {
            ...row,
            status: "REJECTED",
            message: "Could not import this row",
          };
          await CsvImportJob.updateOne(
            { _id: jobId, status: "COMMITTING", "rows.rowNumber": row.rowNumber },
            { $set: { "rows.$.status": "REJECTED", "rows.$.message": failed.message } },
          );
          outcomes.push(failed);
        }
      } else {
        outcomes.push({ ...row });
      }
    }
    const createdRows = outcomes.filter((row) => row.status === "CREATED").length;
    const linkedRows = outcomes.filter((row) => row.status === "LINKED").length;
    const skippedRows = outcomes.filter((row) => row.status === "SKIPPED").length;
    const rejectedRows = outcomes.filter((row) => row.status === "REJECTED").length;
    const completedAt = new Date();
    const committed = await CsvImportJob.findOneAndUpdate(
      { _id: jobId, institutionId: scope.institutionId, status: "COMMITTING" },
      {
        $set: {
          status: "COMMITTED",
          createdRows,
          linkedRows,
          skippedRows,
          rejectedRows,
          completedAt,
          expiresAt: null,
          rows: [],
        },
      },
      { returnDocument: "after" },
    );
    if (!committed) throw AppError.conflict("This import job is no longer available");
    await recordInstitutionEvent({
      actorUserId: scope.userId,
      actorRole: scope.designation,
      actorEmail: scope.user.email,
      action: "STUDENT_IMPORT_COMMIT",
      targetType: "CSV_IMPORT_JOB",
      targetId: String(jobId),
      institutionId: scope.institutionId,
      scopeDescription: `${scope.scopeType}:${scope.scopeId ?? scope.institutionId}`,
      details: `created=${createdRows},linked=${linkedRows},skipped=${skippedRows},rejected=${rejectedRows}`,
    });
    return {
      jobId,
      status: committed.status,
      totalRows: committed.totalRows,
      createdRows,
      linkedRows,
      skippedRows,
      rejectedRows,
      rows: outcomes.map(({ rowNumber, status, message, rollNumber, email }) => ({
        rowNumber, status, message, rollNumber: rollNumber ?? null, email: email ?? null,
      })),
      errorCsv: errorCsv(outcomes),
      completedAt,
    };
  } catch (error) {
    await CsvImportJob.updateOne(
      { _id: jobId, status: "COMMITTING" },
      { $set: { status: "FAILED", rows: [], expiresAt: null } },
    );
    throw error;
  }
}

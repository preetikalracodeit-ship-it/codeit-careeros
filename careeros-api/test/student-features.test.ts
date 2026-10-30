import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { Express } from "express";
import { buildPdf } from "../src/lib/pdf.js";

let replSet: MongoMemoryReplSet;
let app: Express;
let ensureIndexes: () => Promise<void>;

const registration = {
  fullName: "Feature Student",
  email: "features@example.edu",
  mobile: "9876543210",
  password: "Password1",
  termsAccepted: true,
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function registerStudent(email = registration.email) {
  const response = await request(app).post("/api/v1/auth/register").send({ ...registration, email });
  expect(response.status).toBe(201);
  return {
    token: response.body.data.accessToken as string,
    userId: response.body.data.user.id as number,
  };
}

async function seedTarget() {
  const { Career } = await import("../src/models/Career.js");
  const { Skill } = await import("../src/models/Skill.js");
  const { CareerSkill } = await import("../src/models/CareerSkill.js");
  const { StudentProfile } = await import("../src/models/StudentProfile.js");
  await Career.create({
    _id: 301,
    name: "Backend Engineer",
    category: "SOFTWARE_DEVELOPMENT",
    difficultyLevel: "INTERMEDIATE",
    published: true,
  });
  await Skill.create([
    { _id: 302, name: "JavaScript", category: "PROGRAMMING_LANGUAGES", active: true },
    { _id: 303, name: "SQL", category: "DATABASES", active: true },
  ]);
  await CareerSkill.create([
    { _id: 304, careerId: 301, skillId: 302, weightPercent: 60, requiredLevel: "INTERMEDIATE", targetPercent: 75 },
    { _id: 305, careerId: 301, skillId: 303, weightPercent: 40, requiredLevel: "INTERMEDIATE", targetPercent: 70 },
  ]);
  await StudentProfile.updateOne({ userId: 1 }, {
    $set: { targetCareerId: 301, targetCareerName: "Backend Engineer" },
  });
  return { careerId: 301, javascriptId: 302, sqlId: 303 };
}

function cvBytes(): Buffer {
  return buildPdf("Feature Student", "Backend Engineer", (doc) => {
    doc.keyValue("Email", "features@example.edu");
    doc.keyValue("Phone", "+91 98765 43210");
    doc.heading("Professional Summary");
    doc.text("Motivated computer science student building backend services with JavaScript and SQL. I enjoy turning requirements into reliable APIs.");
    doc.heading("Technical Skills");
    doc.text("JavaScript, Node.js, SQL, React, Git, Docker, data structures");
    doc.heading("Experience");
    doc.bullet("Backend intern at Acme Labs (2025): built REST endpoints and SQL reports.");
    doc.heading("Projects");
    doc.bullet("Inventory API: Node.js service backed by SQL with automated tests.");
    doc.bullet("Campus dashboard: React interface that visualises student progress.");
    doc.heading("Education");
    doc.text("B.Tech in Computer Science, Northfield Institute of Technology, 2022 to 2026.");
    doc.heading("Certifications");
    doc.bullet("Node.js API certificate");
  });
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replSet.getUri());
  const db = await import("../src/lib/db.js");
  ensureIndexes = db.ensureIndexes;
  await ensureIndexes();
  const { createApp } = await import("../src/app.js");
  app = createApp();
}, 180000);

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
  await ensureIndexes();
});

describe("CV analysis", () => {
  it("uploads, analyzes, and downloads a student CV", async () => {
    const { token } = await registerStudent();
    await seedTarget();
    const bytes = cvBytes();

    const uploaded = await request(app)
      .post("/api/v1/cvs")
      .set(authHeader(token))
      .attach("file", bytes, { filename: "feature-cv.pdf", contentType: "application/pdf" });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data).toMatchObject({
      originalFilename: "feature-cv.pdf",
      status: "PARSED",
      candidateEmail: "features@example.edu",
      candidateName: "Feature Student",
    });

    const analysis = await request(app).get("/api/v1/cvs/analysis").set(authHeader(token));
    expect(analysis.status).toBe(200);
    expect(analysis.body.data).toMatchObject({ hasCv: true, hasTarget: true, careerId: 301 });
    expect(analysis.body.data.detectedSkills.map((skill: { skillName: string }) => skill.skillName)).toEqual(
      expect.arrayContaining(["JavaScript", "SQL"]),
    );
    expect(analysis.body.data.atsScore).toBeGreaterThan(0);
    expect(analysis.body.data.sections.length).toBeGreaterThan(0);

    const download = await request(app).get("/api/v1/cvs/download").set(authHeader(token));
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.body).toEqual(bytes);

    const replaced = await request(app)
      .post("/api/v1/cvs")
      .set(authHeader(token))
      .attach("file", Buffer.from("not a pdf"), { filename: "broken.pdf", contentType: "application/pdf" });
    expect(replaced.status).toBe(400);
    const failed = await request(app).get("/api/v1/cvs/me").set(authHeader(token));
    expect(failed.body.data.status).toBe("FAILED");
  });

  it("rejects unsupported CV file types", async () => {
    const { token } = await registerStudent();
    const response = await request(app)
      .post("/api/v1/cvs")
      .set(authHeader(token))
      .attach("file", Buffer.from("hello"), { filename: "cv.txt", contentType: "text/plain" });
    expect(response.status).toBe(400);
  });
});

describe("reports", () => {
  it("lists reports and downloads readiness and assessment PDFs", async () => {
    const { token } = await registerStudent();
    const ids = await seedTarget();
    const { AssessmentTest } = await import("../src/models/AssessmentTest.js");
    const { AssessmentAttempt } = await import("../src/models/AssessmentAttempt.js");
    const { SkillScore } = await import("../src/models/SkillScore.js");

    await AssessmentTest.create({
      _id: 401,
      careerId: ids.careerId,
      title: "Backend fundamentals",
      durationMinutes: 30,
      published: true,
    });
    const now = new Date();
    await AssessmentAttempt.create({
      _id: 402,
      attemptCode: "report-attempt",
      userId: 1,
      assessmentId: 401,
      status: "SUBMITTED",
      startedAt: now,
      expiresAt: now,
      submittedAt: now,
      totalQuestions: 10,
      answeredCount: 10,
      overallScore: 70,
    });
    await SkillScore.create([
      { _id: 403, attemptId: 402, skillId: ids.javascriptId, scorePercent: 80, correctCount: 8, questionCount: 10, weightPercent: 60, targetPercent: 75, level: "STRONG" },
      { _id: 404, attemptId: 402, skillId: ids.sqlId, scorePercent: 45, correctCount: 5, questionCount: 10, weightPercent: 40, targetPercent: 70, level: "NEEDS_IMPROVEMENT" },
    ]);

    const listed = await request(app).get("/api/v1/reports").set(authHeader(token));
    expect(listed.status).toBe(200);
    expect(listed.body.data.map((report: { type: string }) => report.type)).toEqual([
      "readiness",
      "assessment",
      "gap-analysis",
      "roadmap",
      "overall",
    ]);
    const readinessRow = listed.body.data.find((report: { type: string }) => report.type === "readiness");
    expect(readinessRow).toMatchObject({ available: true });
    expect(readinessRow.statusDetail).toContain("ready");

    const readiness = await request(app).get("/api/v1/reports/readiness").set(authHeader(token));
    expect(readiness.status).toBe(200);
    expect(readiness.body.data).toMatchObject({
      targetCareerId: ids.careerId,
      targetCareerName: "Backend Engineer",
      readinessPercent: 86,
      submittedAttempts: 1,
    });

    for (const type of ["readiness", "assessment", "overall"]) {
      const pdf = await request(app).get(`/api/v1/reports/${type}/download`).set(authHeader(token));
      expect(pdf.status).toBe(200);
      expect(pdf.headers["content-type"]).toContain("application/pdf");
      expect(pdf.headers["content-disposition"]).toContain(`${type}-report.pdf`);
      expect(pdf.body.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });

  it("requires a target career for career-specific reports", async () => {
    const { token } = await registerStudent();
    const readiness = await request(app).get("/api/v1/reports/roadmap").set(authHeader(token));
    expect(readiness.status).toBe(400);
    expect(readiness.body.message).toContain("target career");
  });
});

describe("improvement plans", () => {
  it("lets the owning student update task status", async () => {
    const { token } = await registerStudent();
    const { ImprovementPlan } = await import("../src/models/ImprovementPlan.js");
    const { ImprovementTask } = await import("../src/models/ImprovementTask.js");
    await ImprovementPlan.create({
      _id: 501,
      studentProfileId: 1,
      userId: 1,
      title: "Close SQL gaps",
      status: "ACTIVE",
    });
    await ImprovementTask.create({
      _id: 502,
      planId: 501,
      title: "Practise joins",
      priority: "HIGH",
      status: "NOT_STARTED",
    });

    const listed = await request(app).get("/api/v1/students/me/improvement-plans").set(authHeader(token));
    expect(listed.status).toBe(200);
    expect(listed.body.data.items[0]).toMatchObject({ id: 501, progressPercent: 0 });

    const updated = await request(app)
      .patch("/api/v1/students/me/improvement-plans/tasks/502")
      .set(authHeader(token))
      .send({ status: "COMPLETED" });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ status: "COMPLETED", progressPercent: 100 });
    expect(updated.body.data.tasks[0]).toMatchObject({ id: 502, status: "COMPLETED" });
  });

  it("hides another student's tasks and staff-only statuses", async () => {
    await registerStudent();
    const other = await registerStudent("other.features@example.edu");
    const { ImprovementPlan } = await import("../src/models/ImprovementPlan.js");
    const { ImprovementTask } = await import("../src/models/ImprovementTask.js");
    await ImprovementPlan.create({ _id: 511, studentProfileId: 1, userId: 1, title: "Plan", status: "ACTIVE" });
    await ImprovementTask.create({ _id: 512, planId: 511, title: "Task", priority: "LOW", status: "NOT_STARTED" });

    const denied = await request(app)
      .patch("/api/v1/students/me/improvement-plans/tasks/512")
      .set(authHeader(other.token))
      .send({ status: "COMPLETED" });
    expect(denied.status).toBe(404);

    const staffOnly = await request(app)
      .patch("/api/v1/students/me/improvement-plans/tasks/512")
      .set(authHeader((await registerStudent("third.features@example.edu")).token))
      .send({ status: "OVERDUE" });
    expect(staffOnly.status).toBe(400);
  });
});

describe("college student cohort access", () => {
  it("supports tenant-scoped placement setup, drive registration, stage updates, and offers", async () => {
    const staff = await registerStudent("placement.tpo@example.edu");
    const student = await registerStudent("placement.student@example.edu");
    const { User } = await import("../src/models/User.js");
    const { StudentProfile } = await import("../src/models/StudentProfile.js");
    const { Institution } = await import("../src/models/Institution.js");
    const { InstitutionMembership } = await import("../src/models/InstitutionMembership.js");
    const { Department } = await import("../src/models/Department.js");
    const { Program } = await import("../src/models/Program.js");
    const { AcademicYear } = await import("../src/models/AcademicYear.js");
    const { Batch } = await import("../src/models/Batch.js");
    const { StudentEnrollment } = await import("../src/models/StudentEnrollment.js");

    await User.updateOne({ _id: staff.userId }, { $set: { role: "TPO" } });
    await Institution.create({ _id: 910, code: "PLACEMENT-COLLEGE", name: "Placement College", status: "ACTIVE" });
    await Department.create({ _id: 911, institutionId: 910, code: "CSE", name: "Computer Science", status: "ACTIVE" });
    await Program.create({ _id: 912, institutionId: 910, departmentId: 911, code: "BTECH", name: "B.Tech", status: "ACTIVE" });
    await AcademicYear.create({ _id: 913, institutionId: 910, label: "2026-27", active: true });
    await Batch.create({ _id: 914, programId: 912, academicYearId: 913, label: "2026", graduationYear: 2026, status: "ACTIVE" });
    const profile = await StudentProfile.findOne({ userId: student.userId }).lean();
    expect(profile).toBeTruthy();
    await StudentEnrollment.create({
      _id: 915,
      studentProfileId: profile!._id,
      institutionId: 910,
      departmentId: 911,
      programId: 912,
      batchId: 914,
      rollNumber: "P-001",
      status: "ACTIVE",
    });
    await InstitutionMembership.create({
      _id: 916,
      userId: staff.userId,
      institutionId: 910,
      designation: "TPO",
      status: "ACTIVE",
      scopeType: "INSTITUTION",
      scopeId: null,
    });

    const companyResponse = await request(app)
      .post("/api/v1/college/placement/companies")
      .set(authHeader(staff.token))
      .send({ name: "Example Systems", contactEmail: "recruiting@example.com", recruitmentStatus: "ACTIVE" });
    expect(companyResponse.status).toBe(200);
    const companyId = companyResponse.body.data.id as number;

    const jobResponse = await request(app)
      .post("/api/v1/college/placement/jobs")
      .set(authHeader(staff.token))
      .send({ companyId, title: "Software Engineer", salaryMin: 50000, salaryMax: 90000, status: "OPEN" });
    expect(jobResponse.status).toBe(200);
    const jobId = jobResponse.body.data.id as number;

    const driveResponse = await request(app)
      .post("/api/v1/college/placement/drives")
      .set(authHeader(staff.token))
      .send({
        companyId,
        jobId,
        name: "2026 Graduate Hiring",
        registrationStart: "2026-10-01",
        registrationEnd: "2026-12-01",
        driveDate: "2026-12-10",
        eligibleDepartmentId: 911,
        eligibleProgramId: 912,
        eligibleBatchId: 914,
        eligibleGraduationYear: 2026,
        status: "REGISTRATION_OPEN",
      });
    expect(driveResponse.status).toBe(200);
    const driveId = driveResponse.body.data.id as number;
    expect(driveResponse.body.data).toMatchObject({
      companyName: "Example Systems",
      jobTitle: "Software Engineer",
      eligibleDepartmentName: "Computer Science",
      applicationCount: 0,
    });

    const studentDrives = await request(app)
      .get("/api/v1/students/me/placement/drives")
      .set(authHeader(student.token));
    expect(studentDrives.status).toBe(200);
    expect(studentDrives.body.data.items).toHaveLength(1);
    expect(studentDrives.body.data.items[0]).toMatchObject({ eligible: true, alreadyApplied: false });

    const registered = await request(app)
      .post(`/api/v1/students/me/placement/drives/${driveId}/register`)
      .set(authHeader(student.token));
    expect(registered.status).toBe(200);

    const driveDetail = await request(app)
      .get(`/api/v1/college/placement/drives/${driveId}`)
      .set(authHeader(staff.token));
    expect(driveDetail.status).toBe(200);
    expect(driveDetail.body.data.applications).toHaveLength(1);
    const applicationId = driveDetail.body.data.applications[0].id as number;

    const advanced = await request(app)
      .patch(`/api/v1/college/placement/applications/${applicationId}`)
      .set(authHeader(staff.token))
      .send({ stage: "TECHNICAL_INTERVIEW", note: "Technical round scheduled" });
    expect(advanced.status).toBe(200);
    expect(advanced.body.data.history.at(-1)).toMatchObject({ stage: "TECHNICAL_INTERVIEW", note: "Technical round scheduled" });

    const offer = await request(app)
      .post(`/api/v1/college/placement/applications/${applicationId}/offer`)
      .set(authHeader(staff.token))
      .send({ packageAmount: 80000, currency: "USD", status: "PENDING" });
    expect(offer.status).toBe(200);
    expect(offer.body.data).toMatchObject({ applicationId, packageAmount: 80000, currency: "USD", status: "PENDING" });

    const forbiddenCompany = await request(app)
      .get("/api/v1/college/placement/companies")
      .set(authHeader(student.token));
    expect(forbiddenCompany.status).toBe(403);
  });

  it("previews, validates, commits, and clears staged student CSV rows", async () => {
    const staff = await registerStudent("import.hod@example.edu");
    const { User } = await import("../src/models/User.js");
    const { Institution } = await import("../src/models/Institution.js");
    const { InstitutionMembership } = await import("../src/models/InstitutionMembership.js");
    const { Department } = await import("../src/models/Department.js");
    const { Program } = await import("../src/models/Program.js");
    const { AcademicYear } = await import("../src/models/AcademicYear.js");
    const { Batch } = await import("../src/models/Batch.js");
    const { CsvImportJob } = await import("../src/models/CsvImportJob.js");
    const { StudentEnrollment } = await import("../src/models/StudentEnrollment.js");

    await User.updateOne({ _id: staff.userId }, { $set: { role: "HOD" } });
    await Institution.create({
      _id: 810,
      code: "IMPORT-COLLEGE",
      name: "Import College",
      status: "ACTIVE",
    });
    await Department.create({
      _id: 811,
      institutionId: 810,
      code: "CSE",
      name: "Computer Science",
      status: "ACTIVE",
    });
    await Program.create({
      _id: 812,
      institutionId: 810,
      departmentId: 811,
      code: "BTECH",
      name: "B.Tech",
      status: "ACTIVE",
    });
    await AcademicYear.create({ _id: 813, institutionId: 810, label: "2026-27", active: true });
    await Batch.create({
      _id: 814,
      programId: 812,
      academicYearId: 813,
      label: "2026",
      status: "ACTIVE",
    });
    await InstitutionMembership.create({
      _id: 815,
      userId: staff.userId,
      institutionId: 810,
      designation: "HOD",
      status: "ACTIVE",
      scopeType: "DEPARTMENT",
      scopeId: 811,
    });

    const preview = await request(app)
      .post("/api/v1/college/students/import/preview")
      .set(authHeader(staff.token))
      .attach(
        "file",
        Buffer.from([
          "full_name,email,roll_number,department_code,program_code,batch_label",
          "New Student,new.import@example.edu,IMP-001,CSE,BTECH,2026",
          "Duplicate Student,new.import@example.edu,IMP-002,CSE,BTECH,2026",
        ].join("\r\n")),
        { filename: "students.csv", contentType: "text/csv" },
      );
    expect(preview.status).toBe(200);
    expect(preview.body.data).toMatchObject({
      totalRows: 2,
      readyRows: 1,
      rejectedRows: 1,
    });
    expect(preview.body.data.rows.map((row: { status: string }) => row.status)).toEqual(["READY", "REJECTED"]);
    const jobId = preview.body.data.jobId as number;

    const committed = await request(app)
      .post(`/api/v1/college/students/import/${jobId}/commit`)
      .set(authHeader(staff.token));
    expect(committed.status).toBe(200);
    expect(committed.body.data.rows.map((row: { status: string }) => row.status)).toEqual(["CREATED", "REJECTED"]);
    expect(committed.body.data).toMatchObject({
      jobId,
      status: "COMMITTED",
      totalRows: 2,
      createdRows: 1,
      rejectedRows: 1,
    });
    expect(committed.body.data.errorCsv).toContain("Duplicate email within the file");
    expect(await StudentEnrollment.exists({ institutionId: 810, rollNumber: "IMP-001" })).toBeTruthy();
    const storedJob = await CsvImportJob.findById(jobId).lean();
    expect(storedJob?.rows).toHaveLength(0);

    const replay = await request(app)
      .post(`/api/v1/college/students/import/${jobId}/commit`)
      .set(authHeader(staff.token));
    expect(replay.status).toBe(409);
  });

  it("limits cohort reads and enrollment updates to the staff member's assigned tenant scope", async () => {
    const staff = await registerStudent("hod.features@example.edu");
    const firstStudent = await registerStudent("cohort.features@example.edu");
    const foreignStudent = await registerStudent("foreign.features@example.edu");

    const { User } = await import("../src/models/User.js");
    const { StudentProfile } = await import("../src/models/StudentProfile.js");
    const { Institution } = await import("../src/models/Institution.js");
    const { InstitutionMembership } = await import("../src/models/InstitutionMembership.js");
    const { Department } = await import("../src/models/Department.js");
    const { Program } = await import("../src/models/Program.js");
    const { AcademicYear } = await import("../src/models/AcademicYear.js");
    const { Batch } = await import("../src/models/Batch.js");
    const { StudentEnrollment } = await import("../src/models/StudentEnrollment.js");
    const { AssessmentAttempt } = await import("../src/models/AssessmentAttempt.js");
    const { AssessmentTest } = await import("../src/models/AssessmentTest.js");

    const firstProfile = await StudentProfile.findOne({ userId: firstStudent.userId }).lean();
    const foreignProfile = await StudentProfile.findOne({ userId: foreignStudent.userId }).lean();
    expect(firstProfile).toBeTruthy();
    expect(foreignProfile).toBeTruthy();

    await Institution.create([
      { _id: 710, code: "SCOPE-A", name: "Scope College A", status: "ACTIVE", timezone: "America/Los_Angeles" },
      { _id: 720, code: "SCOPE-B", name: "Scope College B", status: "ACTIVE" },
    ]);
    await Department.create([
      { _id: 711, institutionId: 710, code: "CSE", name: "Computer Science", status: "ACTIVE" },
      { _id: 721, institutionId: 720, code: "CSE", name: "Foreign Computer Science", status: "ACTIVE" },
    ]);
    await Program.create([
      { _id: 712, institutionId: 710, departmentId: 711, code: "BTECH", name: "B.Tech", status: "ACTIVE" },
      { _id: 722, institutionId: 720, departmentId: 721, code: "BTECH", name: "Foreign B.Tech", status: "ACTIVE" },
    ]);
    await AcademicYear.create([
      { _id: 713, institutionId: 710, label: "2026-27", active: true },
      { _id: 723, institutionId: 720, label: "2026-27", active: true },
    ]);
    await Batch.create([
      { _id: 714, programId: 712, academicYearId: 713, label: "2026", status: "ACTIVE" },
      { _id: 724, programId: 722, academicYearId: 723, label: "2026", status: "ACTIVE" },
    ]);
    await StudentEnrollment.create([
      {
        _id: 715,
        studentProfileId: firstProfile!._id,
        institutionId: 710,
        departmentId: 711,
        programId: 712,
        batchId: 714,
        rollNumber: "A-001",
        status: "ACTIVE",
      },
      {
        _id: 725,
        studentProfileId: foreignProfile!._id,
        institutionId: 720,
        departmentId: 721,
        programId: 722,
        batchId: 724,
        rollNumber: "B-001",
        status: "ACTIVE",
      },
    ]);
    await AssessmentTest.create({
      _id: 730,
      careerId: 731,
      title: "Scoped Assessment",
      durationMinutes: 30,
      published: true,
    });
    await AssessmentAttempt.create({
      _id: 732,
      attemptCode: "SCOPED-ATTEMPT",
      userId: firstStudent.userId,
      assessmentId: 730,
      status: "SUBMITTED",
      startedAt: new Date("2026-10-02T06:20:00.000Z"),
      expiresAt: new Date("2026-10-02T06:50:00.000Z"),
      submittedAt: new Date("2026-10-02T06:30:00.000Z"),
      totalQuestions: 1,
      answeredCount: 1,
    });
    await User.updateOne({ _id: staff.userId }, { $set: { role: "HOD" } });
    await InstitutionMembership.create({
      _id: 716,
      userId: staff.userId,
      institutionId: 710,
      designation: "HOD",
      status: "ACTIVE",
      scopeType: "DEPARTMENT",
      scopeId: 711,
    });

    const cohort = await request(app)
      .get("/api/v1/college/students?page=0&size=10")
      .set(authHeader(staff.token));
    expect(cohort.status).toBe(200);
    expect(cohort.body.data).toMatchObject({
      totalElements: 1,
      page: 0,
      size: 10,
    });
    expect(cohort.body.data.items[0]).toMatchObject({
      id: 715,
      studentId: firstProfile!.studentId,
      rollNumber: "A-001",
    });

    const dashboard = await request(app)
      .get("/api/v1/college/dashboard?departmentId=711")
      .set(authHeader(staff.token));
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data).toMatchObject({
      institutionName: "Scope College A",
      totalEnrolled: 1,
      activeStudents: 1,
      assessmentParticipants: 1,
      studentsNotAssessed: 0,
      assessmentCompletionPercent: 100,
      readinessEvaluated: 0,
      readinessUnavailable: 1,
    });

    const datedDashboard = await request(app)
      .get("/api/v1/college/dashboard?assessmentDateFrom=2026-10-01&assessmentDateTo=2026-10-02")
      .set(authHeader(staff.token));
    expect(datedDashboard.status).toBe(200);
    expect(datedDashboard.body.data).toMatchObject({
      totalEnrolled: 1,
      activeStudents: 1,
      assessmentParticipants: 1,
      studentsNotAssessed: 0,
    });

    const nextLocalDayDashboard = await request(app)
      .get("/api/v1/college/dashboard?assessmentDateFrom=2026-10-02&assessmentDateTo=2026-10-02")
      .set(authHeader(staff.token));
    expect(nextLocalDayDashboard.status).toBe(200);
    expect(nextLocalDayDashboard.body.data).toMatchObject({
      totalEnrolled: 1,
      assessmentParticipants: 0,
      studentsNotAssessed: 1,
    });

    await StudentProfile.updateOne(
      { _id: firstProfile!._id },
      { $set: { fullName: "=SUM(1,1)" } },
    );
    const rosterReport = await request(app)
      .get("/api/v1/college/reports/export.csv?type=roster")
      .set(authHeader(staff.token));
    expect(rosterReport.status).toBe(200);
    expect(rosterReport.headers["content-type"]).toContain("text/csv");
    expect(rosterReport.headers["content-disposition"]).toContain("careeros-student-roster-");
    expect(rosterReport.text).toContain("Student ID,Roll Number,Full Name");
    expect(rosterReport.text).toContain(firstProfile!.studentId);
    expect(rosterReport.text).toContain("'=SUM(1,1)");

    const studentExport = await request(app)
      .get("/api/v1/college/students/export.csv")
      .set(authHeader(staff.token));
    expect(studentExport.status).toBe(200);
    expect(studentExport.headers["content-disposition"]).toContain("careeros-students-");
    expect(studentExport.text).toContain("Student ID,Roll Number,Full Name");

    const unsupportedReport = await request(app)
      .get("/api/v1/college/reports/export.csv?type=unknown")
      .set(authHeader(staff.token));
    expect(unsupportedReport.status).toBe(400);

    const cohortPdf = await request(app)
      .get("/api/v1/college/reports/cohort.pdf")
      .set(authHeader(staff.token));
    expect(cohortPdf.status).toBe(200);
    expect(cohortPdf.headers["content-type"]).toContain("application/pdf");
    expect(cohortPdf.body.subarray(0, 5).toString()).toBe("%PDF-");

    const studentPdf = await request(app)
      .get("/api/v1/college/students/715/report.pdf")
      .set(authHeader(staff.token));
    expect(studentPdf.status).toBe(200);
    expect(studentPdf.headers["content-type"]).toContain("application/pdf");
    expect(studentPdf.headers["content-disposition"]).toContain("careeros-student-715-report.pdf");
    expect(studentPdf.body.subarray(0, 5).toString()).toBe("%PDF-");

    const foreignDashboard = await request(app)
      .get("/api/v1/college/dashboard?departmentId=721")
      .set(authHeader(staff.token));
    expect(foreignDashboard.status).toBe(404);

    const invalidDashboardRange = await request(app)
      .get("/api/v1/college/dashboard?assessmentDateFrom=2026-10-02&assessmentDateTo=2026-10-01")
      .set(authHeader(staff.token));
    expect(invalidDashboardRange.status).toBe(400);

    const foreignDetail = await request(app)
      .get("/api/v1/college/students/725")
      .set(authHeader(staff.token));
    expect(foreignDetail.status).toBe(404);

    const foreignDepartment = await request(app)
      .get("/api/v1/college/students?departmentId=721")
      .set(authHeader(staff.token));
    expect(foreignDepartment.status).toBe(404);

    const update = await request(app)
      .patch("/api/v1/college/students/715/status")
      .set(authHeader(staff.token))
      .send({ status: "GRADUATED" });
    expect(update.status).toBe(200);
    expect(update.body.data).toMatchObject({ enrollmentId: 715, status: "GRADUATED" });

    const foreignUpdate = await request(app)
      .patch("/api/v1/college/students/725/status")
      .set(authHeader(staff.token))
      .send({ status: "GRADUATED" });
    expect(foreignUpdate.status).toBe(404);

    const { AuditEvent } = await import("../src/models/AuditEvent.js");
    const updateAudit = await AuditEvent.findOne({
      action: "STUDENT_STATUS_UPDATE",
      targetId: "715",
    }).lean();
    expect(updateAudit).toMatchObject({
      actorUserId: staff.userId,
      institutionId: 710,
      details: "from=ACTIVE,to=GRADUATED",
    });
  });
});

describe("placements", () => {
  it("lists drives, registers, withdraws, and responds to an offer", async () => {
    const { token } = await registerStudent();
    await seedTarget();
    const { PlacementDrive } = await import("../src/models/PlacementDrive.js");
    const { PlacementApplication } = await import("../src/models/PlacementApplication.js");
    await PlacementDrive.create([
      {
        _id: 601,
        collegeId: null,
        name: "Backend Drive",
        companyName: "Acme",
        jobTitle: "Backend Engineer",
        status: "REGISTRATION_OPEN",
        registrationStart: new Date(Date.now() - 86_400_000),
        registrationEnd: new Date(Date.now() + 86_400_000),
      },
      {
        _id: 602,
        collegeId: null,
        name: "Data Drive",
        companyName: "DataCo",
        jobTitle: "Data Analyst",
        status: "ONGOING",
      },
    ]);
    await PlacementApplication.create({
      _id: 603,
      driveId: 602,
      userId: 1,
      studentProfileId: 1,
      stage: "OFFERED",
      eligibilityOverride: false,
      appliedAt: new Date(),
      history: [],
      offer: { id: 604, packageAmount: 900000, currency: "INR", status: "PENDING", offerDate: new Date() },
    });

    const drives = await request(app).get("/api/v1/students/me/placement/drives").set(authHeader(token));
    expect(drives.status).toBe(200);
    expect(drives.body.data.items).toHaveLength(2);
    const backend = drives.body.data.items.find((item: { drive: { id: number } }) => item.drive.id === 601);
    expect(backend).toMatchObject({ eligible: true, alreadyApplied: false });

    const registered = await request(app)
      .post("/api/v1/students/me/placement/drives/601/register")
      .set(authHeader(token));
    expect(registered.status).toBe(200);
    expect(registered.body.data).toMatchObject({ driveId: 601, stage: "REGISTERED" });

    const duplicate = await request(app)
      .post("/api/v1/students/me/placement/drives/601/register")
      .set(authHeader(token));
    expect(duplicate.status).toBe(409);

    const applications = await request(app).get("/api/v1/students/me/placement/applications").set(authHeader(token));
    expect(applications.body.data.items).toHaveLength(2);
    expect(applications.body.data.items[0].history.length).toBeGreaterThan(0);

    const applicationId = registered.body.data.id as number;
    const withdrawn = await request(app)
      .patch(`/api/v1/students/me/placement/applications/${applicationId}/withdraw`)
      .set(authHeader(token));
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.data.stage).toBe("WITHDRAWN");

    const accepted = await request(app)
      .patch("/api/v1/students/me/placement/offers/604/respond?status=ACCEPTED")
      .set(authHeader(token));
    expect(accepted.status).toBe(200);
    expect(accepted.body.data).toMatchObject({ id: 604, status: "ACCEPTED" });
  });

  it("blocks registration when readiness is below the drive minimum", async () => {
    const { token } = await registerStudent();
    await seedTarget();
    const { PlacementDrive } = await import("../src/models/PlacementDrive.js");
    await PlacementDrive.create({
      _id: 611,
      collegeId: null,
      name: "High Bar Drive",
      companyName: "Selective",
      jobTitle: "Engineer",
      status: "REGISTRATION_OPEN",
      minimumReadinessPercent: 90,
    });
    const response = await request(app)
      .post("/api/v1/students/me/placement/drives/611/register")
      .set(authHeader(token));
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("not eligible");
  });
});

describe("AI assistant", () => {
  it("creates sessions, generates grounded replies, and enforces ownership", async () => {
    const owner = await registerStudent();
    await seedTarget();
    const other = await registerStudent("other.ai@example.edu");

    const status = await request(app).get("/api/v1/ai/status").set(authHeader(owner.token));
    expect(status.status).toBe(200);
    expect(status.body.data).toMatchObject({ configured: false, mode: "offline-smart" });

    const created = await request(app)
      .post("/api/v1/ai/chat/sessions")
      .set(authHeader(owner.token))
      .send({});
    expect(created.status).toBe(201);
    const sessionId = created.body.data.id as number;

    const reply = await request(app)
      .post(`/api/v1/ai/chat/sessions/${sessionId}/messages`)
      .set(authHeader(owner.token))
      .send({ message: "What are my biggest skill gaps and what should I learn next?" });
    expect(reply.status).toBe(200);
    expect(reply.body.data).toMatchObject({ sessionId, offline: true, mode: "offline-smart" });
    expect(reply.body.data.reply).toContain("Backend Engineer");
    expect(reply.body.data.toolsUsed.length).toBeGreaterThan(0);

    const history = await request(app)
      .get(`/api/v1/ai/chat/sessions/${sessionId}`)
      .set(authHeader(owner.token));
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data[0]).toMatchObject({ role: "USER" });
    expect(history.body.data[1]).toMatchObject({ role: "ASSISTANT" });

    const sessions = await request(app).get("/api/v1/ai/chat/sessions").set(authHeader(owner.token));
    expect(sessions.body.data[0]).toMatchObject({ id: sessionId });

    expect((await request(app).get(`/api/v1/ai/chat/sessions/${sessionId}`).set(authHeader(other.token))).status).toBe(404);
    expect((await request(app).delete(`/api/v1/ai/chat/sessions/${sessionId}`).set(authHeader(other.token))).status).toBe(404);

    const removed = await request(app)
      .delete(`/api/v1/ai/chat/sessions/${sessionId}`)
      .set(authHeader(owner.token));
    expect(removed.status).toBe(200);
    expect((await request(app).get(`/api/v1/ai/chat/sessions/${sessionId}`).set(authHeader(owner.token))).status).toBe(404);
  });

  it("answers general technology questions without personal data", async () => {
    const { token } = await registerStudent();
    const created = await request(app).post("/api/v1/ai/chat/sessions").set(authHeader(token)).send({ title: "Learning" });
    const sessionId = created.body.data.id as number;
    const reply = await request(app)
      .post(`/api/v1/ai/chat/sessions/${sessionId}/messages`)
      .set(authHeader(token))
      .send({ message: "Explain the difference between SQL joins" });
    expect(reply.status).toBe(200);
    expect(reply.body.data.reply).toContain("SQL");
    expect(reply.body.data.toolsUsed).toEqual([]);
  });
});

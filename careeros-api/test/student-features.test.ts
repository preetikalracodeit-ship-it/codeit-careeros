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





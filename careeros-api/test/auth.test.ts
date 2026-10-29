import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import type { Express } from "express";
import type { AuditEventDoc } from "../src/models/AuditEvent.js";

let replSet: MongoMemoryReplSet;
let app: Express;
let mongoTempDir: string;
let ensureIndexes: () => Promise<void>;
let User: typeof import("../src/models/User.js").User;

const registration = {
  fullName: "Test Student",
  email: "test.student@example.edu",
  mobile: "9876543210",
  password: "Password1",
  termsAccepted: true,
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  mongoTempDir = await mkdtemp(path.join(tmpdir(), "careeros-mongo-memory-"));
  const { env } = await import("../src/config/env.js");
  env.profilePhotoDir = path.join(mongoTempDir, "profile-photos");
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ storageEngine: "wiredTiger", dbPath: mongoTempDir }],
  });
  await mongoose.connect(replSet.getUri());

  const db = await import("../src/lib/db.js");
  ensureIndexes = db.ensureIndexes;
  await ensureIndexes();

  User = (await import("../src/models/User.js")).User;

  const { createApp } = await import("../src/app.js");
  app = createApp();
}, 180000);

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
  }
  if (mongoTempDir) {
    await rm(mongoTempDir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
  await ensureIndexes();
});

describe("health and meta", () => {
  it("reports liveness", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "UP" });
  });

  it("reports readiness with a database", async () => {
    const response = await request(app).get("/health/readiness");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "UP" });
  });

  it("returns the standard envelope for meta/version", async () => {
    const response = await request(app).get("/api/v1/meta/version");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Success",
      data: { service: "careeros-api", version: "0.1.0" },
    });
    expect(typeof response.body.timestamp).toBe("string");
  });

  it("returns the catalog", async () => {
    const response = await request(app).get("/api/v1/meta/catalog");
    expect(response.status).toBe(200);
    expect(response.body.data.skillLevels).toContain("EXPERT");
    expect(response.body.data.questionTypes).toEqual(["MCQ"]);
  });
});

describe("registration and login", () => {
  it("registers a student and returns a session", async () => {
    const response = await request(app).post("/api/v1/auth/register").send(registration);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Registration successful");
    expect(response.body.data.tokenType).toBe("Bearer");
    expect(response.body.data.expiresIn).toBe(900);
    expect(typeof response.body.data.accessToken).toBe("string");
    expect(typeof response.body.data.refreshToken).toBe("string");
    expect(response.body.data.consentRequired).toBe(false);
    expect(response.body.data.consentPolicyVersion).toBe("2026-10-26");
    expect(response.body.data.user).toMatchObject({
      id: 1,
      email: registration.email,
      fullName: registration.fullName,
      role: "STUDENT",
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("assigns increasing numeric IDs", async () => {
    await request(app).post("/api/v1/auth/register").send(registration);
    const second = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registration, email: "second@example.edu" });

    expect(second.status).toBe(201);
    expect(second.body.data.user.id).toBe(2);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/v1/auth/register").send(registration);
    const response = await request(app).post("/api/v1/auth/register").send(registration);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      errorCode: "CONFLICT",
      message: "An account with this email already exists",
    });
    expect(response.body.data).toBeUndefined();
  });

  it("requires explicit terms acceptance", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registration, termsAccepted: false });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe("BAD_REQUEST");
    expect(response.body.message).toBe(
      "You must accept the Terms of Service and Privacy Policy to create an account",
    );
  });

  it("returns validation field errors in the Spring shape", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "not-an-email", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errorCode).toBe("VALIDATION_ERROR");
    expect(response.body.message).toMatch(/^Validation failed for field '/);
    expect(Array.isArray(response.body.fieldErrors)).toBe(true);
    const fields = response.body.fieldErrors.map((item: { field: string }) => item.field);
    expect(fields).toContain("fullName");
    expect(fields).toContain("email");
    expect(fields).toContain("mobile");
    expect(fields).toContain("password");
    expect(response.body.data).toBeUndefined();
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Malformed request",
      errorCode: "BAD_REQUEST",
    });
  });

  it("logs in with the registered password", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const response = await request(app).post("/api/v1/auth/login").send({
      email: registration.email,
      password: registration.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Login successful");
    expect(response.body.data.user.id).toBe(registered.body.data.user.id);
  });

  it("rejects a wrong password with 401", async () => {
    await request(app).post("/api/v1/auth/register").send(registration);
    const response = await request(app).post("/api/v1/auth/login").send({
      email: registration.email,
      password: "WrongPass1",
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: "Invalid email or password",
      errorCode: "UNAUTHORIZED",
    });
  });
});

describe("authenticated endpoints", () => {
  it("rejects unauthenticated /auth/me", async () => {
    const response = await request(app).get("/api/v1/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication is required");
  });

  it("returns the current user for a valid token", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const token = registered.body.data.accessToken;
    const response = await request(app).get("/api/v1/auth/me").set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(registration.email);
  });

  it("stops accepting tokens for deactivated accounts", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const token = registered.body.data.accessToken;
    await User.updateOne({ _id: 1 }, { $set: { status: "INACTIVE" } });

    const response = await request(app).get("/api/v1/auth/me").set(authHeader(token));
    expect(response.status).toBe(401);
  });

  it("reports consent state and records re-consent", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const token = registered.body.data.accessToken;

    const status = await request(app).get("/api/v1/auth/consent").set(authHeader(token));
    expect(status.body.data.consentCurrent).toBe(true);
    expect(status.body.data.method).toBe("PASSWORD_REGISTRATION");

    const accepted = await request(app)
      .post("/api/v1/auth/consent")
      .set(authHeader(token))
      .send({ termsAccepted: true });
    expect(accepted.status).toBe(200);
    expect(accepted.body.message).toBe("Consent recorded");

    const rejected = await request(app)
      .post("/api/v1/auth/consent")
      .set(authHeader(token))
      .send({ termsAccepted: false });
    expect(rejected.status).toBe(400);
  });

  it("returns public auth config", async () => {
    const response = await request(app).get("/api/v1/auth/config");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ googleClientId: "", googleConfigured: false });
  });

  it("accepts an existing Spring BCrypt $2a password hash", async () => {
    const springHash = (await bcrypt.hash("Password1", 10)).replace(/^\$2b\$/, "$2a$");
    expect(springHash.startsWith("$2a$")).toBe(true);
    const { User: UserModel } = await import("../src/models/User.js");
    await UserModel.create({
      _id: 42,
      email: "legacy@example.edu",
      emailLower: "legacy@example.edu",
      passwordHash: springHash,
      fullName: "Legacy Student",
      role: "STUDENT",
      status: "ACTIVE",
    });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "legacy@example.edu", password: "Password1" });
    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(42);
  });
});

describe("Google sign-in", () => {
  async function withGoogle<T>(run: () => Promise<T>): Promise<T> {
    const { env } = await import("../src/config/env.js");
    const previous = env.googleClientId;
    env.googleClientId = "test-google-client";
    try {
      return await run();
    } finally {
      env.googleClientId = previous;
      vi.unstubAllGlobals();
    }
  }

  function stubTokenInfo(payload: Record<string, unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
      }),
    );
  }

  const validToken = {
    aud: "test-google-client",
    iss: "https://accounts.google.com",
    exp: Math.floor(Date.now() / 1000) + 600,
    email: "google.student@example.edu",
    email_verified: "true",
    name: "Google Student",
    sub: "google-sub-1",
    picture: "https://example.com/photo.png",
  };

  it("registers a new student from a verified Google token", async () => {
    await withGoogle(async () => {
      stubTokenInfo(validToken);
      const response = await request(app)
        .post("/api/v1/auth/google")
        .send({ idToken: "id-token", termsAccepted: true });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Google sign-in successful");
      expect(response.body.data.user.email).toBe("google.student@example.edu");
      expect(response.body.data.user.role).toBe("STUDENT");
      expect(response.body.data.consentRequired).toBe(false);
    });
  });

  it("signs an existing Google user in without re-accepting terms", async () => {
    await withGoogle(async () => {
      stubTokenInfo(validToken);
      await request(app)
        .post("/api/v1/auth/google")
        .send({ idToken: "id-token", termsAccepted: true });

      const second = await request(app).post("/api/v1/auth/google").send({ idToken: "id-token" });
      expect(second.status).toBe(200);
      expect(second.body.data.user.id).toBe(1);
    });
  });

  it("rejects a token issued for another audience", async () => {
    await withGoogle(async () => {
      stubTokenInfo({ ...validToken, aud: "someone-else" });
      const response = await request(app)
        .post("/api/v1/auth/google")
        .send({ idToken: "id-token", termsAccepted: true });
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Google credential was not issued for this app.");
    });
  });
});

describe("refresh rotation and logout", () => {
  it("rotates refresh tokens and revokes all sessions on reuse", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const firstRefresh = registered.body.data.refreshToken;

    const rotated = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstRefresh });
    expect(rotated.status).toBe(200);
    expect(rotated.body.message).toBe("Token refreshed");
    expect(rotated.body.data.refreshToken).not.toBe(firstRefresh);

    const reused = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstRefresh });
    expect(reused.status).toBe(401);
    expect(reused.body.message).toBe(
      "Refresh token reuse detected. All sessions revoked.",
    );

    const afterReuse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotated.body.data.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it("rejects an expired refresh token", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const { RefreshToken } = await import("../src/models/RefreshToken.js");
    await RefreshToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: registered.body.data.refreshToken });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Refresh token has expired");
  });

  it("revokes the refresh token on logout", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const refreshToken = registered.body.data.refreshToken;

    const logout = await request(app).post("/api/v1/auth/logout").send({ refreshToken });
    expect(logout.status).toBe(200);
    expect(logout.body.data).toBeUndefined();

    const afterLogout = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it("treats logout without a token as a successful no-op", async () => {
    const response = await request(app).post("/api/v1/auth/logout").send({});
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Logged out successfully");
  });
});

describe("password recovery", () => {
  it("returns a generic response and allows one use of a hashed reset token", async () => {
    const { env } = await import("../src/config/env.js");
    const previousMode = env.NODE_ENV;
    env.NODE_ENV = "development";
    try {
      const registered = await request(app).post("/api/v1/auth/register").send(registration);
      const refreshToken = registered.body.data.refreshToken as string;
      const missingAccount = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "not-registered@example.edu" });
      const knownAccount = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: registration.email.toUpperCase() });

      expect(missingAccount.status).toBe(200);
      expect(knownAccount.status).toBe(200);
      expect(missingAccount.body.data.message).toBe(knownAccount.body.data.message);
      expect(missingAccount.body.data.resetToken).toBeUndefined();
      expect(knownAccount.body.data.resetToken).toMatch(/^[\da-f]{64}$/);

      const resetToken = knownAccount.body.data.resetToken as string;
      const { PasswordResetToken } = await import("../src/models/PasswordResetToken.js");
      const stored = await PasswordResetToken.findOne({ userId: registered.body.data.user.id }).lean();
      expect(stored?.tokenHash).not.toBe(resetToken);
      expect(stored?.used).toBe(false);

      const reset = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: resetToken, newPassword: "NewPassword2" });
      expect(reset.status).toBe(200);
      expect(reset.body.message).toBe("Password updated. Sign in with your new password.");

      const revokedSession = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
      expect(revokedSession.status).toBe(401);

      const replay = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: resetToken, newPassword: "OtherPassword3" });
      expect(replay.status).toBe(400);

      const oldPassword = await request(app).post("/api/v1/auth/login").send({
        email: registration.email,
        password: registration.password,
      });
      const newPassword = await request(app).post("/api/v1/auth/login").send({
        email: registration.email,
        password: "NewPassword2",
      });
      expect(oldPassword.status).toBe(401);
      expect(newPassword.status).toBe(200);
    } finally {
      env.NODE_ENV = previousMode;
    }
  });
});

describe("settings and role guards", () => {
  it("serves the published career catalog and lets a student select a career", async () => {
    const { Career } = await import("../src/models/Career.js");
    const { Skill } = await import("../src/models/Skill.js");
    const { CareerSkill } = await import("../src/models/CareerSkill.js");
    await Career.create({
      _id: 11,
      name: "Software Developer",
      description: "Build software products",
      category: "SOFTWARE_DEVELOPMENT",
      difficultyLevel: "BEGINNER",
      published: true,
    });
    await Career.create({
      _id: 12,
      name: "Draft Career",
      category: "OTHER",
      difficultyLevel: "BEGINNER",
      published: false,
    });
    await Skill.create({ _id: 21, name: "JavaScript", category: "PROGRAMMING_LANGUAGES" });
    await CareerSkill.create({
      _id: 31,
      careerId: 11,
      skillId: 21,
      weightPercent: 80,
      requiredLevel: "INTERMEDIATE",
      targetPercent: 75,
    });

    const catalog = await request(app).get("/api/v1/careers");
    expect(catalog.status).toBe(200);
    expect(catalog.body.data).toHaveLength(1);
    expect(catalog.body.data[0]).toMatchObject({ id: 11, skillCount: 1 });

    const detail = await request(app).get("/api/v1/careers/11");
    expect(detail.body.data.skills[0]).toMatchObject({
      skillId: 21,
      skillName: "JavaScript",
      weightPercent: 80,
    });
    expect((await request(app).get("/api/v1/careers/12")).status).toBe(404);

    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const chosen = await request(app)
      .put("/api/v1/students/me/career")
      .set(authHeader(registered.body.data.accessToken))
      .send({ careerId: 11 });
    expect(chosen.status).toBe(200);
    expect(chosen.body.message).toBe("Target career updated");
    expect(chosen.body.data).toMatchObject({ targetCareerId: 11, targetCareerName: "Software Developer" });
  });

  it("returns and updates the authenticated student's profile", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const token = registered.body.data.accessToken;

    const initial = await request(app)
      .get("/api/v1/students/me")
      .set(authHeader(token));
    expect(initial.status).toBe(200);
    expect(initial.body.data).toMatchObject({
      id: 1,
      studentId: "STU000001",
      fullName: registration.fullName,
      email: registration.email,
      mobile: registration.mobile,
    });
    expect(initial.body.data).not.toHaveProperty("college");

    const updated = await request(app)
      .put("/api/v1/students/me")
      .set(authHeader(token))
      .send({
        fullName: "Updated Student",
        mobile: "9876543210",
        dateOfBirth: "2002-04-15",
        college: "CareerOS University",
        degree: "B.Tech",
        branch: "Computer Science",
        graduationYear: 2027,
        semester: 6,
        location: "Pune",
        githubUrl: "https://github.com/student",
        linkedinUrl: "https://linkedin.com/in/student",
        portfolioUrl: "https://student.example.edu",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.message).toBe("Profile updated");
    expect(updated.body.data).toMatchObject({
      fullName: "Updated Student",
      dateOfBirth: "2002-04-15",
      college: "CareerOS University",
      semester: 6,
    });

    const refreshed = await request(app).get("/api/v1/auth/me").set(authHeader(token));
    expect(refreshed.body.data.fullName).toBe(registration.fullName);
  });

  it("returns only the authenticated student's submitted assessment history", async () => {
    const current = await request(app).post("/api/v1/auth/register").send(registration);
    const other = await request(app).post("/api/v1/auth/register").send({
      ...registration,
      email: "other.student@example.edu",
    });
    const { Career } = await import("../src/models/Career.js");
    const { AssessmentTest } = await import("../src/models/AssessmentTest.js");
    const { AssessmentAttempt } = await import("../src/models/AssessmentAttempt.js");
    await Career.create({
      _id: 41,
      name: "QA Engineer",
      category: "QUALITY_ASSURANCE",
      difficultyLevel: "INTERMEDIATE",
      published: true,
    });
    await AssessmentTest.create({
      _id: 51,
      careerId: 41,
      title: "QA Fundamentals",
      durationMinutes: 30,
      published: true,
    });
    const now = new Date();
    await AssessmentAttempt.create([
      {
        _id: 61,
        attemptCode: "mine-submitted",
        userId: 1,
        assessmentId: 51,
        status: "SUBMITTED",
        startedAt: now,
        expiresAt: now,
        submittedAt: now,
        totalQuestions: 10,
        answeredCount: 10,
        overallScore: 80,
      },
      {
        _id: 62,
        attemptCode: "other-submitted",
        userId: 2,
        assessmentId: 51,
        status: "SUBMITTED",
        startedAt: now,
        expiresAt: now,
        totalQuestions: 10,
        answeredCount: 10,
      },
      {
        _id: 63,
        attemptCode: "mine-in-progress",
        userId: 1,
        assessmentId: 51,
        status: "IN_PROGRESS",
        startedAt: now,
        expiresAt: now,
        totalQuestions: 10,
        answeredCount: 2,
      },
    ]);

    const history = await request(app)
      .get("/api/v1/students/me/attempts?assessmentId=51")
      .set(authHeader(current.body.data.accessToken));
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({
      attemptId: 61,
      assessmentTitle: "QA Fundamentals",
      careerName: "QA Engineer",
      overallScore: 80,
    });
    expect(other.body.data.user.id).toBe(2);
  });

  it("computes career readiness from the latest submitted score per framework skill", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const { Career } = await import("../src/models/Career.js");
    const { Skill } = await import("../src/models/Skill.js");
    const { CareerSkill } = await import("../src/models/CareerSkill.js");
    const { AssessmentTest } = await import("../src/models/AssessmentTest.js");
    const { AssessmentAttempt } = await import("../src/models/AssessmentAttempt.js");
    const { SkillScore } = await import("../src/models/SkillScore.js");
    const { StudentProfile } = await import("../src/models/StudentProfile.js");
    await Career.create({
      _id: 71,
      name: "Data Analyst",
      category: "DATA_AI",
      difficultyLevel: "INTERMEDIATE",
      published: true,
    });
    await Skill.create([
      { _id: 81, name: "SQL", category: "DATABASES" },
      { _id: 82, name: "Python", category: "PROGRAMMING_LANGUAGES" },
    ]);
    await CareerSkill.create([
      { _id: 91, careerId: 71, skillId: 81, weightPercent: 60, requiredLevel: "INTERMEDIATE", targetPercent: 50 },
      { _id: 92, careerId: 71, skillId: 82, weightPercent: 40, requiredLevel: "ADVANCED", targetPercent: 80 },
    ]);
    await StudentProfile.updateOne({ userId: 1 }, {
      $set: { targetCareerId: 71, targetCareerName: "Data Analyst" },
    });
    await AssessmentTest.create({
      _id: 101,
      careerId: 71,
      title: "Data Basics",
      durationMinutes: 30,
      published: true,
    });
    const startedAt = new Date();
    await AssessmentAttempt.create({
      _id: 111,
      attemptCode: "readiness-attempt",
      userId: 1,
      assessmentId: 101,
      status: "SUBMITTED",
      startedAt,
      expiresAt: startedAt,
      submittedAt: startedAt,
      totalQuestions: 10,
      answeredCount: 10,
      overallScore: 60,
    });
    await SkillScore.create([
      { _id: 121, attemptId: 111, skillId: 81, scorePercent: 70, correctCount: 7, questionCount: 10, weightPercent: 60, targetPercent: 50, level: "GOOD" },
      { _id: 122, attemptId: 111, skillId: 82, scorePercent: 50, correctCount: 5, questionCount: 10, weightPercent: 40, targetPercent: 80, level: "DEVELOPING" },
    ]);

    const response = await request(app)
      .get("/api/v1/students/me/readiness")
      .set(authHeader(registered.body.data.accessToken));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      targetCareerId: 71,
      hasTarget: true,
      readinessPercent: 81,
      readinessLevel: "STRONG",
      totalSkills: 2,
      assessedSkills: 2,
      metSkills: 1,
      submittedAttempts: 1,
    });
    expect(response.body.data.gaps[0]).toMatchObject({ skillId: 81, sourceAttemptId: 111 });
  });

  it("lists only published career assessments with active question counts capped at 20", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const { Career } = await import("../src/models/Career.js");
    const { AssessmentTest } = await import("../src/models/AssessmentTest.js");
    const { AssessmentQuestion } = await import("../src/models/AssessmentQuestion.js");
    await Career.create({
      _id: 131,
      name: "Cloud Engineer",
      category: "CLOUD_DEVOPS",
      difficultyLevel: "INTERMEDIATE",
      published: true,
    });
    await AssessmentTest.create([
      { _id: 141, careerId: 131, title: "Published Test", durationMinutes: 45, published: true },
      { _id: 142, careerId: 131, title: "Draft Test", durationMinutes: 30, published: false },
    ]);
    await AssessmentQuestion.create(Array.from({ length: 22 }, (_, index) => ({
      _id: 151 + index,
      assessmentId: 141,
      skillId: 81,
      questionText: `Question ${index + 1}`,
      difficulty: "BEGINNER",
      displayOrder: index,
      active: index !== 0,
    })));

    const response = await request(app)
      .get("/api/v1/assessments/131/available")
      .set(authHeader(registered.body.data.accessToken));
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      assessmentId: 141,
      careerName: "Cloud Engineer",
      title: "Published Test",
      questionCount: 20,
    });
  });

  it("returns an owned in-progress attempt without revealing correct options", async () => {
    const owner = await request(app).post("/api/v1/auth/register").send(registration);
    const other = await request(app).post("/api/v1/auth/register").send({
      ...registration,
      email: "attempt-other@example.edu",
    });
    const { Career } = await import("../src/models/Career.js");
    const { AssessmentTest } = await import("../src/models/AssessmentTest.js");
    const { Skill } = await import("../src/models/Skill.js");
    const { AssessmentQuestion } = await import("../src/models/AssessmentQuestion.js");
    const { AssessmentAttempt } = await import("../src/models/AssessmentAttempt.js");
    const { AssessmentAttemptQuestion } = await import("../src/models/AssessmentAttemptQuestion.js");
    const { QuestionOption } = await import("../src/models/QuestionOption.js");
    await Career.create({ _id: 201, name: "Security Analyst", category: "CYBERSECURITY", difficultyLevel: "BEGINNER", published: true });
    await AssessmentTest.create({ _id: 202, careerId: 201, title: "Security Basics", durationMinutes: 30, published: true });
    await Skill.create({ _id: 203, name: "Threat Modeling", category: "CYBERSECURITY" });
    await AssessmentQuestion.create({
      _id: 204,
      assessmentId: 202,
      skillId: 203,
      questionText: "Which practice identifies threats early?",
      difficulty: "BEGINNER",
      displayOrder: 0,
      active: true,
    });
    const now = new Date();
    await AssessmentAttempt.create({
      _id: 205,
      attemptCode: "state-attempt",
      userId: 1,
      assessmentId: 202,
      status: "IN_PROGRESS",
      startedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      totalQuestions: 1,
      answeredCount: 0,
    });
    await AssessmentAttemptQuestion.create({ _id: 206, attemptId: 205, questionId: 204, displayOrder: 0 });
    await QuestionOption.create([
      { _id: 207, questionId: 204, optionText: "Threat modeling", correct: true, displayOrder: 0 },
      { _id: 208, questionId: 204, optionText: "Ignore risk", correct: false, displayOrder: 1 },
    ]);

    const response = await request(app)
      .get("/api/v1/assessments/attempts/205")
      .set(authHeader(owner.body.data.accessToken));
    expect(response.status).toBe(200);
    expect(response.body.data.questions[0]).toMatchObject({
      questionId: 204,
      questionText: "Which practice identifies threats early?",
      options: expect.arrayContaining([
        expect.objectContaining({ optionId: 207, optionText: "Threat modeling" }),
      ]),
    });
    expect(response.body.data.questions[0].options[0]).not.toHaveProperty("correct");

    const forbidden = await request(app)
      .get("/api/v1/assessments/attempts/205")
      .set(authHeader(other.body.data.accessToken));
    expect(forbidden.status).toBe(403);
  });

  it("starts an attempt once and resumes the same frozen question set", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const { Career } = await import("../src/models/Career.js");
    const { AssessmentTest } = await import("../src/models/AssessmentTest.js");
    const { Skill } = await import("../src/models/Skill.js");
    const { AssessmentQuestion } = await import("../src/models/AssessmentQuestion.js");
    const { QuestionOption } = await import("../src/models/QuestionOption.js");
    const { AssessmentAttemptQuestion } = await import("../src/models/AssessmentAttemptQuestion.js");
    const { CareerSkill } = await import("../src/models/CareerSkill.js");
    await Career.create({ _id: 301, name: "Frontend Developer", category: "SOFTWARE_DEVELOPMENT", difficultyLevel: "BEGINNER", published: true });
    await AssessmentTest.create({ _id: 302, careerId: 301, title: "React Basics", durationMinutes: 20, published: true });
    await Skill.create({ _id: 303, name: "React", category: "FRAMEWORKS" });
    await CareerSkill.create({ _id: 307, careerId: 301, skillId: 303, weightPercent: 100, requiredLevel: "INTERMEDIATE", targetPercent: 80 });
    await AssessmentQuestion.create({
      _id: 304,
      assessmentId: 302,
      skillId: 303,
      questionText: "What renders UI in React?",
      difficulty: "BEGINNER",
      displayOrder: 0,
      active: true,
    });
    await QuestionOption.create([
      { _id: 305, questionId: 304, optionText: "Components", correct: true, displayOrder: 0 },
      { _id: 306, questionId: 304, optionText: "Tables", correct: false, displayOrder: 1 },
    ]);

    const headers = authHeader(registered.body.data.accessToken);
    const noneYet = await request(app).get("/api/v1/assessments/attempts/my?assessmentId=302").set(headers);
    expect(noneYet.status).toBe(200);
    expect(noneYet.body.data).toBeUndefined();
    const first = await request(app).post("/api/v1/assessments/302/start").set(headers);
    const resumed = await request(app).post("/api/v1/assessments/302/start").set(headers);
    expect(first.status).toBe(200);
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.attemptId).toBe(first.body.data.attemptId);
    const latest = await request(app).get("/api/v1/assessments/attempts/my?assessmentId=302").set(headers);
    expect(latest.body.data.attemptId).toBe(first.body.data.attemptId);
    expect(resumed.body.data.questions.map((question: { questionId: number }) => question.questionId)).toEqual([304]);
    expect(await AssessmentAttemptQuestion.countDocuments({ attemptId: first.body.data.attemptId })).toBe(1);

    const attemptId = first.body.data.attemptId;
    const saved = await request(app)
      .put(`/api/v1/assessments/attempts/${attemptId}/answers`)
      .set(headers)
      .send({ questionId: 304, optionId: 305 });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ attemptId, answeredCount: 1, answeredQuestionIds: [304] });

    const submitted = await request(app)
      .post(`/api/v1/assessments/attempts/${attemptId}/submit`)
      .set(headers);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data).toMatchObject({ status: "SUBMITTED", overallScore: 100, answeredCount: 1 });
    expect(submitted.body.data.skills[0]).toMatchObject({ skillId: 303, scorePercent: 100, correctCount: 1 });

    const duplicateSubmit = await request(app)
      .post(`/api/v1/assessments/attempts/${attemptId}/submit`)
      .set(headers);
    expect(duplicateSubmit.status).toBe(400);
  });

  it("validates student profile updates and requires student role", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const invalid = await request(app)
      .put("/api/v1/students/me")
      .set(authHeader(registered.body.data.accessToken))
      .send({ fullName: "", mobile: "123" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.fieldErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "fullName" }),
        expect.objectContaining({ field: "mobile" }),
      ]),
    );

    const admin = await request(app).post("/api/v1/auth/register").send({
      ...registration,
      email: "admin-role@example.edu",
    });
    await User.updateOne({ _id: 2 }, { $set: { role: "COLLEGE_ADMIN" } });
    const denied = await request(app)
      .get("/api/v1/students/me")
      .set(authHeader(admin.body.data.accessToken));
    expect(denied.status).toBe(403);
  });

  it("uploads, serves, and removes only the authenticated student's profile photo", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const ownerHeaders = authHeader(registered.body.data.accessToken);
    const bytes = Buffer.from("png fixture bytes");

    const uploaded = await request(app)
      .post("/api/v1/students/me/photo")
      .set(ownerHeaders)
      .attach("file", bytes, { filename: "portrait.png", contentType: "image/png" });
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.data.profilePhotoUrl).toMatch(/^[\da-f-]+\.png$/i);

    const downloaded = await request(app).get("/api/v1/students/me/photo").set(ownerHeaders);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-type"]).toContain("image/png");
    expect(downloaded.body).toEqual(bytes);

    const anotherStudent = await request(app).post("/api/v1/auth/register").send({
      ...registration,
      email: "another.student@example.edu",
    });
    const otherPhoto = await request(app)
      .get("/api/v1/students/me/photo")
      .set(authHeader(anotherStudent.body.data.accessToken));
    expect(otherPhoto.status).toBe(404);

    const removed = await request(app).delete("/api/v1/students/me/photo").set(ownerHeaders);
    expect(removed.status).toBe(200);
    expect(removed.body.data.profilePhotoUrl).toBeUndefined();
    const missing = await request(app).get("/api/v1/students/me/photo").set(ownerHeaders);
    expect(missing.status).toBe(404);
  });

  it("rejects unsupported profile-photo types and files larger than 2 MB", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const headers = authHeader(registered.body.data.accessToken);
    const wrongType = await request(app)
      .post("/api/v1/students/me/photo")
      .set(headers)
      .attach("file", Buffer.from("not a photo"), { filename: "photo.txt", contentType: "text/plain" });
    expect(wrongType.status).toBe(400);

    const tooLarge = await request(app)
      .post("/api/v1/students/me/photo")
      .set(headers)
      .attach("file", Buffer.alloc(2 * 1024 * 1024 + 1), { filename: "large.png", contentType: "image/png" });
    expect(tooLarge.status).toBe(413);
  });

  it("changes the password and revokes existing sessions", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const token = registered.body.data.accessToken;
    const oldRefresh = registered.body.data.refreshToken;

    const changed = await request(app)
      .put("/api/v1/users/me/password")
      .set(authHeader(token))
      .send({ currentPassword: registration.password, newPassword: "NewPassword2" });
    expect(changed.status).toBe(200);

    const oldSession = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: oldRefresh });
    expect(oldSession.status).toBe(401);

    const oldLogin = await request(app).post("/api/v1/auth/login").send({
      email: registration.email,
      password: registration.password,
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/v1/auth/login").send({
      email: registration.email,
      password: "NewPassword2",
    });
    expect(newLogin.status).toBe(200);
  });

  it("returns a settings snapshot", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const response = await request(app)
      .get("/api/v1/settings/me")
      .set(authHeader(registered.body.data.accessToken));

    expect(response.status).toBe(200);
    expect(response.body.data.account.email).toBe(registration.email);
    expect(response.body.data.profile.studentId).toBe("STU000001");
    expect(response.body.data.activeSessions).toBe(1);
  });

  it("denies a student access to the admin area", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const response = await request(app)
      .get("/api/v1/admin/dashboard")
      .set(authHeader(registered.body.data.accessToken));

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to perform this action",
    );
  });

  it("records denied admin requests as append-only audit events", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    await request(app)
      .get("/api/v1/admin/dashboard?secret=ignored")
      .set(authHeader(registered.body.data.accessToken));

    const { AuditEvent } = await import("../src/models/AuditEvent.js");
    let event: AuditEventDoc | null = null;
    for (let attempt = 0; attempt < 50 && !event; attempt += 1) {
      event = await AuditEvent.findOne({ action: "GET /api/v1/admin/dashboard" }).lean<AuditEventDoc>();
      if (!event) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    expect(event).not.toBeNull();
    expect(event?.outcome).toBe("DENIED");
    expect(event?.httpStatus).toBe(403);
    expect(event?.actorUserId).toBe(1);
    expect(event?.actorRole).toBe("STUDENT");
    expect(event?.targetPath).toBe("/api/v1/admin/dashboard");

    await expect(
      AuditEvent.updateOne({ _id: event?._id }, { $set: { outcome: "SUCCESS" } }),
    ).rejects.toThrow(/append-only/);
    await expect(AuditEvent.deleteOne({ _id: event?._id })).rejects.toThrow(/append-only/);
  });

  it("requires authentication for unknown API routes", async () => {
    const response = await request(app).get("/api/v1/unknown");
    expect(response.status).toBe(401);
  });

  it("returns 404 for unknown API routes when authenticated", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const response = await request(app)
      .get("/api/v1/unknown")
      .set(authHeader(registered.body.data.accessToken));
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Resource not found");
  });

  it("serves the student's ordered roadmap with skill enrichment and isolated progress", async () => {
    const first = await request(app).post("/api/v1/auth/register").send(registration);
    const second = await request(app).post("/api/v1/auth/register").send({ ...registration, email: "second.roadmap@example.edu" });
    const { Career } = await import("../src/models/Career.js");
    const { CareerSkill } = await import("../src/models/CareerSkill.js");
    const { Skill } = await import("../src/models/Skill.js");
    const { StudentProfile } = await import("../src/models/StudentProfile.js");
    const { RoadmapPhase } = await import("../src/models/RoadmapPhase.js");
    const { RoadmapItem } = await import("../src/models/RoadmapItem.js");
    const { AssessmentTest } = await import("../src/models/AssessmentTest.js");
    const { AssessmentAttempt } = await import("../src/models/AssessmentAttempt.js");
    const { SkillScore } = await import("../src/models/SkillScore.js");
    const { RoadmapItemProgress } = await import("../src/models/RoadmapItemProgress.js");

    await Career.create({ _id: 901, name: "Roadmap Engineer", category: "SOFTWARE_DEVELOPMENT", difficultyLevel: "BEGINNER", published: true });
    await Skill.create({ _id: 902, name: "Roadmap JavaScript", category: "PROGRAMMING_LANGUAGES" });
    await CareerSkill.create({ _id: 903, careerId: 901, skillId: 902, weightPercent: 100, requiredLevel: "INTERMEDIATE", targetPercent: 70 });
    await StudentProfile.updateOne({ userId: 1 }, { $set: { targetCareerId: 901, targetCareerName: "Roadmap Engineer" } });
    await StudentProfile.updateOne({ userId: 2 }, { $set: { targetCareerId: 901, targetCareerName: "Roadmap Engineer" } });
    await RoadmapPhase.create([
      { _id: 904, careerId: 901, title: "Advanced", displayOrder: 2, durationDays: 10 },
      { _id: 905, careerId: 901, title: "Foundation", displayOrder: 1, durationDays: 5 },
    ]);
    await RoadmapItem.create([
      { _id: 906, phaseId: 905, skillId: 902, title: "Build fundamentals", displayOrder: 2, estimatedHours: 4 },
      { _id: 907, phaseId: 905, title: "Plan a project", displayOrder: 1, estimatedHours: 2 },
      { _id: 908, phaseId: 904, title: "Ship a project", displayOrder: 1, estimatedHours: 8 },
    ]);
    const submittedAt = new Date();
    await AssessmentTest.create({ _id: 909, careerId: 901, title: "JavaScript check", durationMinutes: 20, published: true });
    await AssessmentAttempt.create({ _id: 910, attemptCode: "roadmap-score", userId: 1, assessmentId: 909, status: "SUBMITTED", startedAt: submittedAt, expiresAt: submittedAt, submittedAt, totalQuestions: 10, answeredCount: 10, overallScore: 60 });
    await SkillScore.create({ _id: 911, attemptId: 910, skillId: 902, scorePercent: 60, correctCount: 6, questionCount: 10, weightPercent: 100, targetPercent: 70, level: "DEVELOPING" });

    const initial = await request(app).get("/api/v1/roadmaps/my").set(authHeader(first.body.data.accessToken));
    expect(initial.status).toBe(200);
    expect(initial.body.data).toMatchObject({ careerId: 901, careerName: "Roadmap Engineer", hasTarget: true, totalItems: 3, completedItems: 0, inProgressItems: 0 });
    expect(initial.body.data.phases.map((phase: { title: string }) => phase.title)).toEqual(["Foundation", "Advanced"]);
    expect(initial.body.data.phases[0].items.map((item: { title: string }) => item.title)).toEqual(["Plan a project", "Build fundamentals"]);
    expect(initial.body.data.phases[0].items[1]).toMatchObject({ skillId: 902, skillName: "Roadmap JavaScript", targetPercent: 70, scorePercent: 60, gapPercent: -10, assessed: true, status: "NOT_STARTED" });

    const updated = await request(app).put("/api/v1/roadmaps/items/906/status").set(authHeader(first.body.data.accessToken)).send({ status: "in_progress" });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ itemId: 906, status: "IN_PROGRESS" });
    expect(await RoadmapItemProgress.countDocuments({ userId: 1, itemId: 906 })).toBe(1);
    expect(await RoadmapItemProgress.countDocuments({ userId: 2, itemId: 906 })).toBe(0);

    const secondView = await request(app).get("/api/v1/roadmaps/my").set(authHeader(second.body.data.accessToken));
    expect(secondView.body.data.inProgressItems).toBe(0);
    const refreshed = await request(app).get("/api/v1/roadmaps/my").set(authHeader(first.body.data.accessToken));
    expect(refreshed.body.data.inProgressItems).toBe(1);
  });

  it("returns an empty roadmap without a selected target career and rejects unknown statuses", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const token = registered.body.data.accessToken;
    const empty = await request(app).get("/api/v1/roadmaps/my").set(authHeader(token));
    expect(empty.body.data).toMatchObject({ hasTarget: false, progressPercent: 0, phases: [] });
    expect((await request(app).put("/api/v1/roadmaps/items/1/status").set(authHeader(token)).send({ status: "DONE" })).status).toBe(400);
  });

  it("lists published career projects and keeps each student's project progress private", async () => {
    const first = await request(app).post("/api/v1/auth/register").send(registration);
    const second = await request(app).post("/api/v1/auth/register").send({ ...registration, email: "second.project@example.edu" });
    const { Career } = await import("../src/models/Career.js");
    const { Skill } = await import("../src/models/Skill.js");
    const { CareerSkill } = await import("../src/models/CareerSkill.js");
    const { StudentProfile } = await import("../src/models/StudentProfile.js");
    const { Project } = await import("../src/models/Project.js");
    const { ProjectSkill } = await import("../src/models/ProjectSkill.js");
    const { ProjectProgress } = await import("../src/models/ProjectProgress.js");

    await Career.create({ _id: 921, name: "Project Engineer", category: "SOFTWARE_DEVELOPMENT", difficultyLevel: "BEGINNER", published: true });
    await Skill.create({ _id: 922, name: "Project TypeScript", category: "PROGRAMMING_LANGUAGES" });
    await CareerSkill.create({ _id: 923, careerId: 921, skillId: 922, weightPercent: 100, requiredLevel: "INTERMEDIATE", targetPercent: 75 });
    await StudentProfile.updateOne({ userId: 1 }, { $set: { targetCareerId: 921, targetCareerName: "Project Engineer" } });
    await StudentProfile.updateOne({ userId: 2 }, { $set: { targetCareerId: 921, targetCareerName: "Project Engineer" } });
    await Project.create([
      { _id: 924, careerId: 921, title: "Published app", difficulty: "BEGINNER", estimatedWeeks: 3, displayOrder: 2, published: true },
      { _id: 925, careerId: 921, title: "Draft app", difficulty: "BEGINNER", estimatedWeeks: 1, displayOrder: 1, published: false },
    ]);
    await ProjectSkill.create({ _id: 926, projectId: 924, skillId: 922 });

    const catalog = await request(app).get("/api/v1/projects/recommended").set(authHeader(first.body.data.accessToken));
    expect(catalog.status).toBe(200);
    expect(catalog.body.data).toMatchObject({ careerId: 921, careerName: "Project Engineer", hasTarget: true, totalProjects: 1, completedProjects: 0, inProgressProjects: 0 });
    expect(catalog.body.data.projects[0]).toMatchObject({ projectId: 924, title: "Published app", status: "NOT_STARTED", skills: [{ skillId: 922, skillName: "Project TypeScript", targetPercent: 75, assessed: false }] });

    const changed = await request(app).put("/api/v1/projects/924/status").set(authHeader(first.body.data.accessToken)).send({ status: "in_progress" });
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ projectId: 924, status: "IN_PROGRESS" });
    expect(await ProjectProgress.countDocuments({ userId: 1, projectId: 924 })).toBe(1);
    expect(await ProjectProgress.countDocuments({ userId: 2, projectId: 924 })).toBe(0);
    const otherStudent = await request(app).get("/api/v1/projects/recommended").set(authHeader(second.body.data.accessToken));
    expect(otherStudent.body.data.inProgressProjects).toBe(0);
  });

  it("saves the student's manual LinkedIn profile and analyzes target skill alignment", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const { Career } = await import("../src/models/Career.js");
    const { CareerSkill } = await import("../src/models/CareerSkill.js");
    const { Skill } = await import("../src/models/Skill.js");
    const { StudentProfile } = await import("../src/models/StudentProfile.js");
    await Career.create({ _id: 941, name: "LinkedIn Analyst", category: "DATA_AI", difficultyLevel: "BEGINNER", published: true });
    await Skill.create([
      { _id: 942, name: "SQL", category: "DATABASES" },
      { _id: 943, name: "Python", category: "PROGRAMMING_LANGUAGES" },
      { _id: 946, name: "Java", category: "PROGRAMMING_LANGUAGES" },
    ]);
    await CareerSkill.create([
      { _id: 944, careerId: 941, skillId: 942, weightPercent: 60, requiredLevel: "INTERMEDIATE", targetPercent: 70 },
      { _id: 945, careerId: 941, skillId: 943, weightPercent: 40, requiredLevel: "INTERMEDIATE", targetPercent: 70 },
    ]);
    await StudentProfile.updateOne({ userId: 1 }, { $set: { targetCareerId: 941, targetCareerName: "LinkedIn Analyst" } });

    const token = registered.body.data.accessToken;
    expect((await request(app).get("/api/v1/linkedin/me").set(authHeader(token))).body.data).toBeUndefined();
    const saved = await request(app).put("/api/v1/linkedin").set(authHeader(token)).send({
      profileUrl: "linkedin.com/in/test-student",
      headline: "Aspiring data analyst with SQL",
      about: "A motivated data professional who builds useful reports and turns business data into clear, thoughtful decisions for teams.",
      experienceText: "Built reporting projects for a student group.",
      skillsText: "MySQL, Excel, dashboards, JavaScript",
      educationText: "BSc Data Science",
    });
    expect(saved.status).toBe(200);
    expect(saved.body.message).toBe("LinkedIn profile saved");
    expect(saved.body.data).toMatchObject({ profileUrl: "https://linkedin.com/in/test-student", headline: "Aspiring data analyst with SQL" });
    const analysis = await request(app).get("/api/v1/linkedin/analysis").set(authHeader(token));
    expect(analysis.status).toBe(200);
    expect(analysis.body.data).toMatchObject({ hasProfile: true, hasTarget: true, careerId: 941, careerName: "LinkedIn Analyst", alignmentPercent: 50 });
    expect(analysis.body.data.detectedSkills).toContainEqual({ skillId: 942, skillName: "SQL", skillCategory: "DATABASES" });
    expect(analysis.body.data.detectedSkills.some((skill: { skillId: number }) => skill.skillId === 946)).toBe(false);
    expect(analysis.body.data.missingSkills.map((skill: { skillId: number }) => skill.skillId)).toEqual([943]);
    expect(analysis.body.data).toMatchObject({ onlyOnCv: [], alsoOnCv: [] });
    expect((await request(app).put("/api/v1/linkedin").set(authHeader(token)).send({ profileUrl: "https://example.com/in/fake" })).status).toBe(400);
  });
});

describe("role workspaces", () => {
  async function createUser(overrides: {
    id: number;
    email: string;
    fullName: string;
    role: "SUPER_ADMIN" | "COLLEGE_ADMIN" | "TPO" | "HOD" | "FACULTY" | "STUDENT";
    collegeId?: number;
    departmentId?: number;
  }) {
    await User.create({
      _id: overrides.id,
      email: overrides.email,
      emailLower: overrides.email.toLowerCase(),
      passwordHash: await bcrypt.hash("Password1", 10),
      fullName: overrides.fullName,
      role: overrides.role,
      status: "ACTIVE",
      collegeId: overrides.collegeId ?? null,
      departmentId: overrides.departmentId ?? null,
    });
  }

  it("lets a super admin create a college workspace and provision its college admin", async () => {
    await createUser({ id: 900, email: "super@example.edu", fullName: "Super Admin", role: "SUPER_ADMIN" });
    const login = await request(app).post("/api/v1/auth/login").send({ email: "super@example.edu", password: "Password1" });
    expect(login.status).toBe(200);
    const headers = authHeader(login.body.data.accessToken);

    const summary = await request(app).get("/api/v1/workspace/summary").set(headers);
    expect(summary.status).toBe(200);
    expect(summary.body.data.stats.colleges).toBe(0);

    const created = await request(app).post("/api/v1/workspace/colleges").set(headers).send({ name: "Demo College", code: "DEMO", city: "Pune" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name: "Demo College", code: "DEMO", status: "ONBOARDING" });
    const collegeId = created.body.data.id;

    const department = await request(app).post(`/api/v1/workspace/colleges/${collegeId}/departments`).set(headers).send({ name: "Computer Science", code: "CSE", hodName: "Dr. Rao" });
    expect(department.status).toBe(201);
    expect(department.body.data.departments).toHaveLength(1);
    const departmentId = department.body.data.departments[0].id;

    const batch = await request(app).post(`/api/v1/workspace/colleges/${collegeId}/batches`).set(headers).send({ name: "CSE 2024", departmentId, year: 2024 });
    expect(batch.status).toBe(201);
    expect(batch.body.data.batches).toHaveLength(1);

    const staff = await request(app).post("/api/v1/workspace/staff").set(headers).send({
      fullName: "College Admin",
      email: "college.admin@example.edu",
      password: "Password1",
      role: "COLLEGE_ADMIN",
      collegeId,
      departmentId,
    });
    expect(staff.status).toBe(201);
    expect(staff.body.data).toMatchObject({ role: "COLLEGE_ADMIN", collegeId, departmentId });

    const adminLogin = await request(app).post("/api/v1/auth/login").send({ email: "college.admin@example.edu", password: "Password1" });
    expect(adminLogin.status).toBe(200);
    const adminHeaders = authHeader(adminLogin.body.data.accessToken);
    const adminSummary = await request(app).get("/api/v1/workspace/summary").set(adminHeaders);
    expect(adminSummary.status).toBe(200);
    expect(adminSummary.body.data).toMatchObject({ role: "COLLEGE_ADMIN", college: { id: collegeId } });
    expect(adminSummary.body.data.stats).toMatchObject({ departments: 1, batches: 1, staff: 1 });

    const renamed = await request(app).patch(`/api/v1/workspace/colleges/${collegeId}`).set(adminHeaders).send({ city: "Mumbai" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.city).toBe("Mumbai");
  });

  it("denies students access to platform administration", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registration);
    const response = await request(app).get("/api/v1/workspace/colleges").set(authHeader(registered.body.data.accessToken));
    expect(response.status).toBe(403);
  });
});

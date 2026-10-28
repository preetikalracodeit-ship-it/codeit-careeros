import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { Express } from "express";
import type { AuditEventDoc } from "../src/models/AuditEvent.js";

let replSet: MongoMemoryReplSet;
let app: Express;
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
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
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

describe("settings and role guards", () => {
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
});

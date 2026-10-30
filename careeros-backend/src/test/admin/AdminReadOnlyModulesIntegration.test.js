const request = require("supertest");

const API_BASE_URL =
  process.env.TEST_API_BASE_URL || "http://localhost:8080";

const api = request(API_BASE_URL);

const ENDPOINTS = [
  "/api/v1/admin/ai/status",
  "/api/v1/admin/roadmaps",
  "/api/v1/admin/projects",
];

/**
 * Extract the access token from the API response.
 * Verify the response structure against TestSupport.token()
 * in the original Java test.
 */
function extractAccessToken(body, context) {
  const token =
    body?.accessToken ??
    body?.data?.accessToken ??
    body?.data?.token ??
    body?.token;

  if (typeof token !== "string" || token.length === 0) {
    throw new Error(
      `${context}: accessToken was not found in the response.`
    );
  }

  return token;
}

async function registerStudent() {
  const response = await api
    .post("/api/v1/auth/register")
    .send({
      fullName: "Readonly Browser",
      email: "readonly-browse@test.local",
      mobile: "9876543210",
      password: "Password1",
      termsAccepted: true,
    })
    .expect(201);

  return extractAccessToken(response.body, "Student registration");
}

async function loginAdmin() {
  const response = await api
    .post("/api/v1/auth/login")
    .send({
      email: "admin@test.local",
      password: "Admin@123Test",
    })
    .expect(200);

  return extractAccessToken(response.body, "Admin login");
}

describe("Admin Read-Only Modules Integration Test", () => {
  test("Anonymous access to read-only admin modules returns 401", async () => {
    for (const endpoint of ENDPOINTS) {
      await api.get(endpoint).expect(401);
    }
  });

  test("STUDENT cannot access read-only admin modules (403)", async () => {
    const studentToken = await registerStudent();

    for (const endpoint of ENDPOINTS) {
      await api
        .get(endpoint)
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(403);
    }
  });

  test("ADMIN can browse AI status, roadmap templates and project catalog", async () => {
    const adminToken = await loginAdmin();

    const aiResponse = await api
      .get("/api/v1/admin/ai/status")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const aiData = aiResponse.body?.data;

    expect(typeof aiData?.provider).toBe("string");
    expect(typeof aiData?.mode).toBe("string");
    expect(typeof aiData?.maxToolIterations).toBe("number");

    // Preserve the original checks that sensitive API-key fields
    // are not exposed in the response.
    expect(aiData?.apiKey == null).toBe(true);
    expect(aiData?.geminiApiKey == null).toBe(true);

    const roadmapResponse = await api
      .get("/api/v1/admin/roadmaps")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(roadmapResponse.body?.data)).toBe(true);

    const projectResponse = await api
      .get("/api/v1/admin/projects")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(projectResponse.body?.data)).toBe(true);
  });
});

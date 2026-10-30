const request = require("supertest");

const API_BASE_URL =
  process.env.TEST_API_BASE_URL || "http://localhost:8080";

const api = request(API_BASE_URL);

/**
 * Equivalent of TestSupport.token(result, "accessToken").
 *
 * Verify the response structure against the existing CareerOS API.
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

async function adminToken() {
  const response = await api
    .post("/api/v1/auth/login")
    .set("Content-Type", "application/json")
    .send({
      email: "admin@test.local",
      password: "Admin@123Test",
    })
    .expect(200);

  return extractAccessToken(response.body, "Admin login");
}

function authorized(token, method, endpoint) {
  return api[method](endpoint).set(
    "Authorization",
    `Bearer ${token}`
  );
}

async function createSkill(token, name, category) {
  const response = await authorized(
    token,
    "post",
    "/api/v1/admin/skills"
  )
    .set("Content-Type", "application/json")
    .send({ name, category })
    .expect(200);

  const id = response.body?.data?.id;

  if (id == null) {
    throw new Error(`Skill "${name}" was created without an ID.`);
  }

  return id;
}

async function createCareer(token, payload) {
  const response = await authorized(
    token,
    "post",
    "/api/v1/admin/careers"
  )
    .set("Content-Type", "application/json")
    .send(payload)
    .expect(200);

  const id = response.body?.data?.id;

  if (id == null) {
    throw new Error("Career was created without an ID.");
  }

  return {
    id,
    body: response.body,
  };
}

async function createAssessment(token, payload) {
  const response = await authorized(
    token,
    "post",
    "/api/v1/admin/assessments"
  )
    .set("Content-Type", "application/json")
    .send(payload)
    .expect(200);

  const id = response.body?.data?.id;

  if (id == null) {
    throw new Error("Assessment was created without an ID.");
  }

  return id;
}

async function createQuestion(token, assessmentId, payload) {
  const response = await authorized(
    token,
    "post",
    `/api/v1/admin/assessments/${assessmentId}/questions`
  )
    .set("Content-Type", "application/json")
    .send(payload)
    .expect(200);

  const id = response.body?.data?.id;

  if (id == null) {
    throw new Error("Question was created without an ID.");
  }

  return {
    id,
    body: response.body,
  };
}

async function deleteResource(token, endpoint) {
  await authorized(token, "delete", endpoint).expect(200);
}

describe("Admin Content Update Integration Test", () => {
  test("Replace the competency framework of an existing career", async () => {
    const token = await adminToken();

    const skillA = await createSkill(
      token,
      "Framework Skill A",
      "TESTING"
    );

    const skillB = await createSkill(
      token,
      "Framework Skill B",
      "TESTING"
    );

    const career = await createCareer(token, {
      name: "Framework Career",
      category: "BUSINESS",
      difficultyLevel: "BEGINNER",
      published: true,
      skills: [
        {
          skillId: skillA,
          weightPercent: 100,
          requiredLevel: "BASIC",
        },
      ],
    });

    const careerId = career.id;

    expect(career.body.data.skills).toHaveLength(1);

    // Replace the existing competency framework.
    const replacement = await authorized(
      token,
      "put",
      `/api/v1/admin/careers/${careerId}/skills`
    )
      .set("Content-Type", "application/json")
      .send([
        {
          skillId: skillA,
          weightPercent: 60,
          requiredLevel: "ADVANCED",
          targetPercent: 80,
        },
        {
          skillId: skillB,
          weightPercent: 40,
          requiredLevel: "INTERMEDIATE",
          targetPercent: 75,
        },
      ])
      .expect(200);

    expect(replacement.body.data.skills).toHaveLength(2);

    // Verify the persisted framework.
    const details = await authorized(
      token,
      "get",
      `/api/v1/admin/careers/${careerId}`
    ).expect(200);

    expect(details.body.data.skills).toHaveLength(2);
    expect(details.body.data.skills[0].weightPercent).toBe(60);

    // Invalid weights must continue to return HTTP 400.
    await authorized(
      token,
      "put",
      `/api/v1/admin/careers/${careerId}/skills`
    )
      .set("Content-Type", "application/json")
      .send([
        {
          skillId: skillA,
          weightPercent: 10,
          requiredLevel: "BASIC",
        },
      ])
      .expect(400);

    // Preserve the original cleanup order.
    await deleteResource(token, `/api/v1/admin/careers/${careerId}`);
    await deleteResource(token, `/api/v1/admin/skills/${skillA}`);
    await deleteResource(token, `/api/v1/admin/skills/${skillB}`);
  });

  test("Update a question replaces its options", async () => {
    const token = await adminToken();

    const skillId = await createSkill(
      token,
      "Question Skill",
      "TESTING"
    );

    const career = await createCareer(token, {
      name: "Question Career",
      category: "BUSINESS",
      difficultyLevel: "BEGINNER",
      published: true,
      skills: [
        {
          skillId,
          weightPercent: 100,
          requiredLevel: "BASIC",
        },
      ],
    });

    const careerId = career.id;

    const assessmentId = await createAssessment(token, {
      careerId,
      title: "Question Assessment",
      durationMinutes: 10,
      published: true,
    });

    const question = await createQuestion(
      token,
      assessmentId,
      {
        assessmentId,
        skillId,
        questionText: "Original?",
        difficulty: "BEGINNER",
        options: [
          {
            optionText: "yes",
            correct: true,
          },
          {
            optionText: "no",
            correct: false,
          },
        ],
      }
    );

    const questionId = question.id;

    // Update the question and replace all its options.
    const updated = await authorized(
      token,
      "put",
      `/api/v1/admin/questions/${questionId}`
    )
      .set("Content-Type", "application/json")
      .send({
        assessmentId,
        skillId,
        questionText: "Updated?",
        difficulty: "INTERMEDIATE",
        options: [
          {
            optionText: "alpha",
            correct: false,
          },
          {
            optionText: "beta",
            correct: true,
          },
          {
            optionText: "gamma",
            correct: false,
          },
        ],
      })
      .expect(200);

    expect(updated.body.data.questionText).toBe("Updated?");
    expect(updated.body.data.options).toHaveLength(3);

    // Preserve the original cleanup order.
    await deleteResource(
      token,
      `/api/v1/admin/questions/${questionId}`
    );

    await deleteResource(
      token,
      `/api/v1/admin/assessments/${assessmentId}`
    );

    await deleteResource(
      token,
      `/api/v1/admin/careers/${careerId}`
    );

    await deleteResource(
      token,
      `/api/v1/admin/skills/${skillId}`
    );
  });
});
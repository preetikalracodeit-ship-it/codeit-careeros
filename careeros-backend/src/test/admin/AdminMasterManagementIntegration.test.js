const request = require("supertest");

const API_BASE_URL =
  process.env.TEST_API_BASE_URL || "http://localhost:8080";

const api = request(API_BASE_URL);

describe("Admin Master Management Integration Test", () => {
  let token;

  let dockerId;
  let k8sId;
  let careerId;
  let assessmentId;
  let questionId;

  beforeEach(async () => {
    /*
     * IMPORTANT:
     * Replace this section with your existing Node.js test-data cleanup
     * mechanism. It must only clean test-owned records.
     *
     * Do not implement broad database deletion here.
     */

    token = await adminToken();
  });

  async function adminToken() {
    const response = await api
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send({
        email: "admin@test.local",
        password: "Admin@123Test",
      })
      .expect(200);

    const accessToken = response.body?.data?.accessToken;

    if (!accessToken) {
      throw new Error(
        "Admin login succeeded, but the access token was not found."
      );
    }

    return accessToken;
  }

  function adminRequest(method, endpoint) {
    return api[method](endpoint).set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  async function createSkill(name, category, description) {
    const response = await adminRequest("post", "/api/v1/admin/skills")
      .send({
        name,
        category,
        description,
      })
      .expect(200);

    expect(response.body.data.name).toBe(name);

    const id = response.body?.data?.id;

    if (id == null) {
      throw new Error(`Skill "${name}" was created without an ID.`);
    }

    return id;
  }

  async function createCareer(skillA, skillB) {
    const response = await adminRequest("post", "/api/v1/admin/careers")
      .send({
        name: "Site Reliability Engineer",
        description: "Runs reliable services",
        category: "CLOUD_DEVOPS",
        difficultyLevel: "ADVANCED",
        published: true,
        skills: [
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
        ],
      })
      .expect(200);

    expect(response.body.data.skills).toHaveLength(2);

    const id = response.body?.data?.id;

    if (id == null) {
      throw new Error("Career was created without an ID.");
    }

    return id;
  }

  async function createAssessment(careerId) {
    const response = await adminRequest(
      "post",
      "/api/v1/admin/assessments"
    )
      .send({
        careerId,
        title: "SRE Onboarding Assessment",
        description: "Baseline skills",
        durationMinutes: 20,
        published: true,
      })
      .expect(200);

    expect(response.body.data.title).toBe(
      "SRE Onboarding Assessment"
    );

    const id = response.body?.data?.id;

    if (id == null) {
      throw new Error("Assessment was created without an ID.");
    }

    return id;
  }

  async function addQuestion(assessmentId, skillId) {
    const response = await adminRequest(
      "post",
      `/api/v1/admin/assessments/${assessmentId}/questions`
    )
      .send({
        assessmentId,
        skillId,
        questionText: "Which command runs a container?",
        difficulty: "INTERMEDIATE",
        questionType: "MCQ",
        options: [
          {
            optionText: "docker run",
            correct: true,
            displayOrder: 1,
          },
          {
            optionText: "docker build",
            correct: false,
            displayOrder: 2,
          },
        ],
      })
      .expect(200);

    expect(response.body.data.skillName).toBe("Docker");

    const id = response.body?.data?.id;

    if (id == null) {
      throw new Error("Question was created without an ID.");
    }

    return id;
  }

  test("Admin manages skills, careers, assessments and questions", async () => {
    // Verify the public metadata catalog.
    const catalog = await api
      .get("/api/v1/meta/catalog")
      .expect(200);

    expect(Array.isArray(catalog.body.data.careerCategories)).toBe(true);
    expect(Array.isArray(catalog.body.data.skillCategories)).toBe(true);
    expect(Array.isArray(catalog.body.data.skillLevels)).toBe(true);
    expect(Array.isArray(catalog.body.data.questionTypes)).toBe(true);

    // Create skills.
    dockerId = await createSkill(
      "Docker",
      "CLOUD",
      "Containers"
    );

    k8sId = await createSkill(
      "Kubernetes",
      "CLOUD",
      "Orchestration"
    );

    // Duplicate skill must be rejected.
    await adminRequest("post", "/api/v1/admin/skills")
      .send({
        name: "Docker",
        category: "CLOUD",
      })
      .expect(409);

    // Create a career with valid skill weights.
    careerId = await createCareer(dockerId, k8sId);

    // Duplicate career must be rejected.
    await adminRequest("post", "/api/v1/admin/careers")
      .send({
        name: "Site Reliability Engineer",
        category: "CLOUD_DEVOPS",
        difficultyLevel: "ADVANCED",
      })
      .expect(409);

    // Invalid skill weights must be rejected.
    await adminRequest("post", "/api/v1/admin/careers")
      .send({
        name: "Bad Weights",
        category: "CLOUD_DEVOPS",
        difficultyLevel: "ADVANCED",
        skills: [
          {
            skillId: dockerId,
            weightPercent: 10,
            requiredLevel: "BASIC",
          },
        ],
      })
      .expect(400);

    // Create assessment and question.
    assessmentId = await createAssessment(careerId);
    questionId = await addQuestion(assessmentId, dockerId);

    // A question without a correct option must be rejected.
    await adminRequest(
      "post",
      `/api/v1/admin/assessments/${assessmentId}/questions`
    )
      .send({
        assessmentId,
        skillId: dockerId,
        questionText: "No correct option?",
        difficulty: "BEGINNER",
        options: [
          {
            optionText: "a",
            correct: false,
          },
          {
            optionText: "b",
            correct: false,
          },
        ],
      })
      .expect(400);

    // Verify the assessment and its question count.
    const assessment = await adminRequest(
      "get",
      `/api/v1/admin/assessments/${assessmentId}`
    ).expect(200);

    expect(assessment.body.data.questions).toHaveLength(1);
    expect(assessment.body.data.questionCount).toBe(1);

    // Verify the created career.
    const careers = await adminRequest(
      "get",
      "/api/v1/admin/careers"
    ).expect(200);

    expect(careers.body.data[0].name).toBe(
      "Site Reliability Engineer"
    );

    // Delete the question and assessment.
    await adminRequest(
      "delete",
      `/api/v1/admin/questions/${questionId}`
    ).expect(200);

    await adminRequest(
      "delete",
      `/api/v1/admin/assessments/${assessmentId}`
    ).expect(200);

    // A skill still referenced by a career must not be deleted.
    const conflict = await adminRequest(
      "delete",
      `/api/v1/admin/skills/${dockerId}`
    ).expect(409);

    expect(conflict.body.errorCode).toBe("CONFLICT");

    // Delete the career, then delete its skills.
    await adminRequest(
      "delete",
      `/api/v1/admin/careers/${careerId}`
    ).expect(200);

    await adminRequest(
      "delete",
      `/api/v1/admin/skills/${dockerId}`
    ).expect(200);

    await adminRequest(
      "delete",
      `/api/v1/admin/skills/${k8sId}`
    ).expect(200);

    // Verify administrative statistics.
    const stats = await adminRequest(
      "get",
      "/api/v1/admin/stats"
    ).expect(200);

    expect(typeof stats.body.data.students).toBe("number");
    expect(typeof stats.body.data.assessmentsCompleted).toBe("number");
  });
});

package com.codeit.careeros.admin;

import com.codeit.careeros.TestSupport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminMasterManagementIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("Admin manages skills, careers, assessments and questions")
    void masterCrudFlow() throws Exception {
        String token = adminToken();

        mockMvc.perform(get("/api/v1/meta/catalog"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.careerCategories").isArray())
                .andExpect(jsonPath("$.data.skillCategories").isArray())
                .andExpect(jsonPath("$.data.skillLevels").isArray())
                .andExpect(jsonPath("$.data.questionTypes").isArray());

        long dockerId = createSkill(token, "Docker", "CLOUD", "Containers");
        long k8sId = createSkill(token, "Kubernetes", "CLOUD", "Orchestration");

        mockMvc.perform(post("/api/v1/admin/skills")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Docker",
                                  "category": "CLOUD"
                                }
                                """))
                .andExpect(status().isConflict());

        long careerId = createCareer(token, dockerId, k8sId);

        mockMvc.perform(post("/api/v1/admin/careers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Site Reliability Engineer",
                                  "category": "CLOUD_DEVOPS",
                                  "difficultyLevel": "ADVANCED"
                                }
                                """))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/v1/admin/careers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Bad Weights",
                                  "category": "CLOUD_DEVOPS",
                                  "difficultyLevel": "ADVANCED",
                                  "skills": [
                                    {"skillId": %d, "weightPercent": 10, "requiredLevel": "BASIC"}
                                  ]
                                }
                                """.formatted(dockerId)))
                .andExpect(status().isBadRequest());

        long assessmentId = createAssessment(token, careerId);

        long questionId = addQuestion(token, assessmentId, dockerId);

        mockMvc.perform(post("/api/v1/admin/assessments/" + assessmentId + "/questions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "assessmentId": %d,
                                  "skillId": %d,
                                  "questionText": "No correct option?",
                                  "difficulty": "BEGINNER",
                                  "options": [
                                    {"optionText": "a", "correct": false},
                                    {"optionText": "b", "correct": false}
                                  ]
                                }
                                """.formatted(assessmentId, dockerId)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/admin/assessments/" + assessmentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions.length()").value(1))
                .andExpect(jsonPath("$.data.questionCount").value(1));

        mockMvc.perform(get("/api/v1/admin/careers")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].name", hasItem("Site Reliability Engineer")));

        mockMvc.perform(delete("/api/v1/admin/questions/" + questionId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/admin/assessments/" + assessmentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/admin/skills/" + dockerId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("CONFLICT"));

        mockMvc.perform(delete("/api/v1/admin/careers/" + careerId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/admin/skills/" + dockerId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/admin/skills/" + k8sId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/stats")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.students").isNumber())
                .andExpect(jsonPath("$.data.assessmentsCompleted").isNumber());
    }

    private long createSkill(String token, String name, String category, String description) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/skills")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "%s",
                                  "category": "%s",
                                  "description": "%s"
                                }
                                """.formatted(name, category, description)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(name))
                .andReturn();
        return parseId(result);
    }

    private long createCareer(String token, long skillA, long skillB) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/careers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Site Reliability Engineer",
                                  "description": "Runs reliable services",
                                  "category": "CLOUD_DEVOPS",
                                  "difficultyLevel": "ADVANCED",
                                  "published": true,
                                  "skills": [
                                    {"skillId": %d, "weightPercent": 60, "requiredLevel": "ADVANCED", "targetPercent": 80},
                                    {"skillId": %d, "weightPercent": 40, "requiredLevel": "INTERMEDIATE", "targetPercent": 75}
                                  ]
                                }
                                """.formatted(skillA, skillB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.skills.length()").value(2))
                .andReturn();
        return parseId(result);
    }

    private long createAssessment(String token, long careerId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/assessments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "careerId": %d,
                                  "title": "SRE Onboarding Assessment",
                                  "description": "Baseline skills",
                                  "durationMinutes": 20,
                                  "published": true
                                }
                                """.formatted(careerId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("SRE Onboarding Assessment"))
                .andReturn();
        return parseId(result);
    }

    private long addQuestion(String token, long assessmentId, long skillId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/assessments/" + assessmentId + "/questions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "assessmentId": %d,
                                  "skillId": %d,
                                  "questionText": "Which command runs a container?",
                                  "difficulty": "INTERMEDIATE",
                                  "questionType": "MCQ",
                                  "options": [
                                    {"optionText": "docker run", "correct": true, "displayOrder": 1},
                                    {"optionText": "docker build", "correct": false, "displayOrder": 2}
                                  ]
                                }
                                """.formatted(assessmentId, skillId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.skillName").value("Docker"))
                .andReturn();
        return parseId(result);
    }

    private long parseId(MvcResult result) throws Exception {
        JsonNode node = mapper.readTree(result.getResponse().getContentAsString());
        return node.path("data").path("id").asLong();
    }

    private String adminToken() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "admin@test.local",
                                  "password": "Admin@123Test"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();
        return TestSupport.token(login, "accessToken");
    }
}
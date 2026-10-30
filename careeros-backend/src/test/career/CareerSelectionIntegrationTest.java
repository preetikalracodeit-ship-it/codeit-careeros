package com.codeit.careeros.career;

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

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Career selection: the published catalog is database-driven, unpublished
 * drafts stay hidden, skill mappings resolve per career, and students can
 * save (and change) their target career. A newly published admin career
 * appears in student selection without any code change.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CareerSelectionIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("Multiple published careers returned, unpublished excluded")
    void listCareers_multiplePublished_unpublishedExcluded() throws Exception {
        String admin = adminToken();
        long javaId = createSkill(admin, "CareerSel Java", "PROGRAMMING_LANGUAGES");
        long sqlId = createSkill(admin, "CareerSel SQL", "PROGRAMMING_LANGUAGES");
        createCareer(admin, "CareerSel Java Dev", "SOFTWARE_DEVELOPMENT", true, javaId, sqlId);
        createCareer(admin, "CareerSel Data Analyst", "DATA_AI", true, sqlId, javaId);
        createCareer(admin, "CareerSel Draft Dev", "SOFTWARE_DEVELOPMENT", false, javaId, sqlId);

        mockMvc.perform(get("/api/v1/careers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.name == 'CareerSel Java Dev')]").isArray())
                .andExpect(jsonPath("$.data[?(@.name == 'CareerSel Data Analyst')]").exists())
                .andExpect(jsonPath("$.data[?(@.name == 'CareerSel Draft Dev')]").isEmpty());
    }

    @Test
    @DisplayName("Career skills endpoint returns the mapped competency framework")
    void careerSkills_returnsMappedSkills() throws Exception {
        String admin = adminToken();
        long javaId = createSkill(admin, "CareerSel2 Java", "PROGRAMMING_LANGUAGES");
        long sqlId = createSkill(admin, "CareerSel2 SQL", "PROGRAMMING_LANGUAGES");
        long careerId = createCareer(admin, "CareerSel2 Backend", "SOFTWARE_DEVELOPMENT", true, javaId, sqlId);

        mockMvc.perform(get("/api/v1/careers/" + careerId + "/skills"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].weightPercent").isNumber())
                .andExpect(jsonPath("$.data[*].skillName").isArray());
    }

    @Test
    @DisplayName("Student selects a career; invalid and unpublished IDs rejected")
    void selectCareer_savesTarget_rejectsBadIds() throws Exception {
        String admin = adminToken();
        long javaId = createSkill(admin, "CareerSel3 Java", "PROGRAMMING_LANGUAGES");
        long sqlId = createSkill(admin, "CareerSel3 SQL", "PROGRAMMING_LANGUAGES");
        long careerId = createCareer(admin, "CareerSel3 Frontend", "SOFTWARE_DEVELOPMENT", true, javaId, sqlId);
        long draftId = createCareer(admin, "CareerSel3 Draft", "SOFTWARE_DEVELOPMENT", false, javaId, sqlId);

        String student = studentToken("careersel3@test.local");

        mockMvc.perform(put("/api/v1/students/me/career")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"careerId\": " + careerId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetCareerId").value(careerId))
                .andExpect(jsonPath("$.data.targetCareerName").value("CareerSel3 Frontend"));

        mockMvc.perform(put("/api/v1/students/me/career")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"careerId\": 999999}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(put("/api/v1/students/me/career")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"careerId\": " + draftId + "}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Career selection is scoped to the owning student")
    void selectCareer_scopedToOwningStudent() throws Exception {
        String admin = adminToken();
        long javaId = createSkill(admin, "CareerSel4 Java", "PROGRAMMING_LANGUAGES");
        long sqlId = createSkill(admin, "CareerSel4 SQL", "PROGRAMMING_LANGUAGES");
        long careerId = createCareer(admin, "CareerSel4 Cloud", "CLOUD_DEVOPS", true, javaId, sqlId);

        String studentA = studentToken("careersel4a@test.local");
        String studentB = studentToken("careersel4b@test.local");

        mockMvc.perform(put("/api/v1/students/me/career")
                        .header("Authorization", "Bearer " + studentA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"careerId\": " + careerId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetCareerId").value(careerId));

        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer " + studentB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetCareerId").doesNotExist());
    }

    @Test
    @DisplayName("Newly published admin career appears in student selection; draft does not")
    void newlyPublishedCareer_appearsForStudents() throws Exception {
        String admin = adminToken();
        long javaId = createSkill(admin, "CareerSel5 Java", "PROGRAMMING_LANGUAGES");
        long sqlId = createSkill(admin, "CareerSel5 SQL", "PROGRAMMING_LANGUAGES");
        long draftId = createCareer(admin, "CareerSel5 Flutter", "SOFTWARE_DEVELOPMENT", false, javaId, sqlId);

        mockMvc.perform(get("/api/v1/careers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.name == 'CareerSel5 Flutter')]").isEmpty());

        mockMvc.perform(put("/api/v1/admin/careers/" + draftId)
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "CareerSel5 Flutter",
                                  "description": "Cross-platform apps",
                                  "category": "SOFTWARE_DEVELOPMENT",
                                  "difficultyLevel": "INTERMEDIATE",
                                  "published": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.published").value(true));

        mockMvc.perform(get("/api/v1/careers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.name == 'CareerSel5 Flutter')]").isNotEmpty());

        String student = studentToken("careersel5@test.local");
        mockMvc.perform(put("/api/v1/students/me/career")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"careerId\": " + draftId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetCareerName").value("CareerSel5 Flutter"));
    }

    private long createSkill(String admin, String name, String category) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/skills")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"%s\", \"category\": \"%s\"}".formatted(name, category)))
                .andExpect(status().isOk())
                .andReturn();
        return parseId(result);
    }

    private long createCareer(String admin, String name, String category, boolean published,
                              long skillA, long skillB) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/careers")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "%s",
                                  "description": "%s track",
                                  "category": "%s",
                                  "difficultyLevel": "INTERMEDIATE",
                                  "published": %s,
                                  "skills": [
                                    {"skillId": %d, "weightPercent": 60, "requiredLevel": "ADVANCED"},
                                    {"skillId": %d, "weightPercent": 40, "requiredLevel": "INTERMEDIATE"}
                                  ]
                                }
                                """.formatted(name, name, category, published, skillA, skillB)))
                .andExpect(status().isOk())
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

    private String studentToken(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Student %s",
                                  "email": "%s",
                                  "mobile": "9876543210",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email, email)))
                .andExpect(status().isCreated())
                .andReturn();
        return TestSupport.token(reg, "accessToken");
    }
}

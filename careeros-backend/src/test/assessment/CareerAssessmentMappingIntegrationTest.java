package com.codeit.careeros.assessment;

import com.codeit.careeros.TestDataCleaner;
import com.codeit.careeros.TestSupport;
import com.codeit.careeros.career.Career;
import com.codeit.careeros.career.CareerSkill;
import com.codeit.careeros.common.enums.CareerCategory;
import com.codeit.careeros.common.enums.DifficultyLevel;
import com.codeit.careeros.common.enums.QuestionType;
import com.codeit.careeros.common.enums.SkillCategory;
import com.codeit.careeros.common.enums.SkillLevel;
import com.codeit.careeros.repository.AssessmentAnswerRepository;
import com.codeit.careeros.repository.AssessmentAttemptRepository;
import com.codeit.careeros.repository.AssessmentQuestionRepository;
import com.codeit.careeros.repository.AssessmentTestRepository;
import com.codeit.careeros.repository.CareerRepository;
import com.codeit.careeros.repository.CareerSkillRepository;
import com.codeit.careeros.repository.ProjectProgressRepository;
import com.codeit.careeros.repository.ProjectRepository;
import com.codeit.careeros.repository.ProjectSkillRepository;
import com.codeit.careeros.repository.QuestionOptionRepository;
import com.codeit.careeros.repository.RoadmapItemProgressRepository;
import com.codeit.careeros.repository.RoadmapItemRepository;
import com.codeit.careeros.repository.RoadmapPhaseRepository;
import com.codeit.careeros.repository.SkillRepository;
import com.codeit.careeros.repository.SkillScoreRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.skill.Skill;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashSet;
import java.util.Set;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Career Selection &rarr; Assessment chain: for any published career the
 * available assessment, its questions, scoring, gap analysis and readiness
 * must all follow the student's selected target career and its live
 * competency framework. No hardcoded careers, skills, weights or thresholds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CareerAssessmentMappingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SkillRepository skillRepository;

    @Autowired
    private CareerRepository careerRepository;

    @Autowired
    private CareerSkillRepository careerSkillRepository;

    @Autowired
    private AssessmentTestRepository assessmentTestRepository;

    @Autowired
    private AssessmentQuestionRepository questionRepository;

    @Autowired
    private QuestionOptionRepository optionRepository;

    @Autowired
    private AssessmentAnswerRepository answerRepository;

    @Autowired
    private AssessmentAttemptRepository attemptRepository;

    @Autowired
    private SkillScoreRepository skillScoreRepository;

    @Autowired
    private StudentProfileRepository studentProfileRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectSkillRepository projectSkillRepository;

    @Autowired
    private ProjectProgressRepository projectProgressRepository;

    @Autowired
    private RoadmapItemProgressRepository roadmapProgressRepository;

    @Autowired
    private RoadmapItemRepository roadmapItemRepository;

    @Autowired
    private RoadmapPhaseRepository roadmapPhaseRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    private Skill java;
    private Skill sql;
    private Career careerA;
    private Career careerB;
    private Career draftCareer;
    private AssessmentTest assessmentA;
    private AssessmentTest assessmentB;
    private AssessmentTest unpublishedAssessmentA;
    private long qAJava1;
    private long qAJava2;
    private long qASql1;
    private long optAJava1;
    private long optAJava2;
    private long optASql1;
    private long qB1;
    private long optB1;

    @Autowired
    private TestDataCleaner testDataCleaner;

    @BeforeEach
    void setUp() {
        testDataCleaner.clean();
        skillScoreRepository.deleteAll();
        answerRepository.deleteAll();
        attemptRepository.deleteAll();
        // Earlier tests in this class registered students whose profiles still
        // point at careers being wiped below; detach first (users are kept).
        java.util.List<com.codeit.careeros.entity.StudentProfile> profiles =
                studentProfileRepository.findAll();
        profiles.forEach(p -> p.setTargetCareer(null));
        studentProfileRepository.saveAll(profiles);
        optionRepository.deleteAll();
        questionRepository.deleteAll();
        assessmentTestRepository.deleteAll();
        careerSkillRepository.deleteAll();
        projectProgressRepository.deleteAll();
        projectSkillRepository.deleteAll();
        projectRepository.deleteAll();
        roadmapProgressRepository.deleteAll();
        roadmapItemRepository.deleteAll();
        roadmapPhaseRepository.deleteAll();
        careerRepository.deleteAll();
        skillRepository.deleteAll();

        java = skill("MapJava", SkillCategory.PROGRAMMING_LANGUAGES);
        sql = skill("MapSql", SkillCategory.DATABASES);

        careerA = career("Map Career A", true);
        framework(careerA, java, 70, SkillLevel.ADVANCED, 80);
        framework(careerA, sql, 30, SkillLevel.INTERMEDIATE, 80);

        careerB = career("Map Career B", true);
        framework(careerB, sql, 60, SkillLevel.ADVANCED, 75);
        framework(careerB, java, 40, SkillLevel.INTERMEDIATE, 75);

        draftCareer = career("Map Draft Career", false);
        framework(draftCareer, java, 100, SkillLevel.BASIC, 60);

        assessmentA = assessment(careerA, "Map Assessment A", true);
        qAJava1 = question(assessmentA, java, "Map A Java Q1", 1);
        qAJava2 = question(assessmentA, java, "Map A Java Q2", 2);
        qASql1 = question(assessmentA, sql, "Map A SQL Q1", 3);
        optAJava1 = option(qAJava1, "final", true);
        option(qAJava1, "static", false);
        optAJava2 = option(qAJava2, "==", true);
        option(qAJava2, "=", false);
        optASql1 = option(qASql1, "WHERE", true);
        option(qASql1, "HAVING", false);

        assessmentB = assessment(careerB, "Map Assessment B", true);
        qB1 = question(assessmentB, sql, "Map B SQL Q1", 1);
        optB1 = option(qB1, "SELECT", true);
        option(qB1, "INSERT", false);

        unpublishedAssessmentA = assessment(careerA, "Map Assessment A Draft", false);
        long qDraft = question(unpublishedAssessmentA, java, "Map A Draft Q1", 1);
        option(qDraft, "x", true);
        option(qDraft, "y", false);
    }

    @Test
    @DisplayName("1. Student selects Career A, Career A assessment is available")
    void selectCareerA_careerAAssessmentAvailable() throws Exception {
        String student = register("map1@test.local");
        selectCareer(student, careerA.getId());

        mockMvc.perform(get("/api/v1/assessments/" + careerA.getId() + "/available")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.assessmentId == " + assessmentA.getId() + ")]").isNotEmpty())
                .andExpect(jsonPath("$.data[?(@.careerId == " + careerA.getId() + ")]").isNotEmpty());
    }

    @Test
    @DisplayName("2. Student selects Career B, Career B assessment is available")
    void selectCareerB_careerBAssessmentAvailable() throws Exception {
        String student = register("map2@test.local");
        selectCareer(student, careerB.getId());

        mockMvc.perform(get("/api/v1/assessments/" + careerB.getId() + "/available")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.assessmentId == " + assessmentB.getId() + ")]").isNotEmpty());
    }

    @Test
    @DisplayName("3. Career A assessment is not returned for Career B")
    void careerAAssessment_notReturnedForCareerB() throws Exception {
        String student = register("map3@test.local");

        mockMvc.perform(get("/api/v1/assessments/" + careerB.getId() + "/available")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.assessmentId == " + assessmentA.getId() + ")]").isEmpty())
                .andExpect(jsonPath("$.data[?(@.careerId == " + careerA.getId() + ")]").isEmpty());
    }

    @Test
    @DisplayName("4. Unpublished assessment is not available and cannot be started")
    void unpublishedAssessment_notAvailable() throws Exception {
        String student = register("map4@test.local");

        mockMvc.perform(get("/api/v1/assessments/" + careerA.getId() + "/available")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.assessmentId == " + unpublishedAssessmentA.getId() + ")]").isEmpty());

        mockMvc.perform(post("/api/v1/assessments/" + unpublishedAssessmentA.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("5. Student with a target career cannot start another career's assessment")
    void studentCannotStartOtherCareerAssessment() throws Exception {
        String student = register("map5@test.local");
        selectCareer(student, careerA.getId());

        mockMvc.perform(post("/api/v1/assessments/" + assessmentB.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/assessments/" + assessmentA.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.assessmentId").value(assessmentA.getId()));
    }

    @Test
    @DisplayName("5b. Student without a target career can still start a published assessment")
    void studentWithoutTarget_canStartAssessment() throws Exception {
        String student = register("map5b@test.local");

        mockMvc.perform(post("/api/v1/assessments/" + assessmentA.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("6. Started assessment returns exactly its own questions")
    void questionsBelongToCorrectAssessment() throws Exception {
        String student = register("map6@test.local");
        selectCareer(student, careerA.getId());

        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentA.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions", hasSize(3)))
                .andReturn();
        JsonNode data = mapper.readTree(start.getResponse().getContentAsString()).path("data");
        for (JsonNode q : data.path("questions")) {
            long id = q.path("questionId").asLong();
            org.junit.jupiter.api.Assertions.assertTrue(
                    id == qAJava1 || id == qAJava2 || id == qASql1,
                    "question " + id + " must belong to assessment A");
        }
    }

    @Test
    @DisplayName("7. Questions map to the career framework skills")
    void questionsMapToFrameworkSkills() throws Exception {
        String student = register("map7@test.local");
        selectCareer(student, careerA.getId());

        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentA.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data = mapper.readTree(start.getResponse().getContentAsString()).path("data");
        Set<String> skills = new HashSet<>();
        for (JsonNode q : data.path("questions")) {
            skills.add(q.path("skillName").asText());
        }
        org.junit.jupiter.api.Assertions.assertEquals(
                Set.of("MapJava", "MapSql"), skills);
    }

    @Test
    @DisplayName("8+9. Scoring and skill scores use the selected career framework weights")
    void scoringUsesCareerFramework() throws Exception {
        String student = register("map89@test.local");
        selectCareer(student, careerA.getId());
        long attemptId = startAttempt(student, assessmentA.getId());

        answer(student, attemptId, qAJava1, optAJava1);
        answer(student, attemptId, qAJava2, optAJava2);
        answer(student, attemptId, qASql1, optASql1);

        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                // Java 2/2 = 100 (weight 70), SQL 1/1 = 100 (weight 30) -> 100
                .andExpect(jsonPath("$.data.overallScore").value(100))
                .andExpect(jsonPath("$.data.skills.length()").value(2))
                .andExpect(jsonPath("$.data.skills[?(@.skillName == 'MapJava')].weightPercent").value(70))
                .andExpect(jsonPath("$.data.skills[?(@.skillName == 'MapSql')].weightPercent").value(30))
                .andExpect(jsonPath("$.data.skills[?(@.skillName == 'MapJava')].targetPercent").value(80));
    }

    @Test
    @DisplayName("8b. Partial answers weight by the framework: Java 1/2, SQL 1/1 -> 65")
    void partialScoringWeightedByFramework() throws Exception {
        String student = register("map8b@test.local");
        selectCareer(student, careerA.getId());
        long attemptId = startAttempt(student, assessmentA.getId());

        answer(student, attemptId, qAJava1, optAJava1);
        // qAJava2 left unanswered (0/2 for MapJava), SQL correct
        answer(student, attemptId, qASql1, optASql1);

        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                // Java 1/2 = 50 * 70 + SQL 100 * 30 -> (3500 + 3000) / 100 = 65
                .andExpect(jsonPath("$.data.overallScore").value(65));
    }

    @Test
    @DisplayName("10+11. Gap analysis and readiness use the selected career")
    void gapAndReadinessUseSelectedCareer() throws Exception {
        String student = register("map1011@test.local");
        selectCareer(student, careerA.getId());
        long attemptId = startAttempt(student, assessmentA.getId());
        answer(student, attemptId, qAJava1, optAJava1);
        answer(student, attemptId, qASql1, optASql1);
        submit(student, attemptId);

        mockMvc.perform(get("/api/v1/students/me/readiness")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(true))
                .andExpect(jsonPath("$.data.targetCareerId").value(careerA.getId()))
                .andExpect(jsonPath("$.data.targetCareerName").value("Map Career A"))
                .andExpect(jsonPath("$.data.gaps.length()").value(2))
                .andExpect(jsonPath("$.data.gaps[?(@.skillName == 'MapJava')].weightPercent").value(70))
                .andExpect(jsonPath("$.data.gaps[?(@.skillName == 'MapJava')].targetPercent").value(80))
                // readiness = 100 * (70*min(50,80) + 30*min(100,80)) / (70*80 + 30*80)
                //         = 100 * (3500 + 2400) / 8000 = 73.75 -> 74
                .andExpect(jsonPath("$.data.readinessPercent").value(74));
    }

    @Test
    @DisplayName("12. Changing career switches readiness; history keeps its career link")
    void changingCareer_refreshesTargetData() throws Exception {
        String student = register("map12@test.local");
        selectCareer(student, careerA.getId());
        long attemptId = startAttempt(student, assessmentA.getId());
        answer(student, attemptId, qAJava1, optAJava1);
        submit(student, attemptId);

        selectCareer(student, careerB.getId());

        mockMvc.perform(get("/api/v1/students/me/readiness")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetCareerId").value(careerB.getId()))
                .andExpect(jsonPath("$.data.targetCareerName").value("Map Career B"))
                .andExpect(jsonPath("$.data.gaps.length()").value(2))
                .andExpect(jsonPath("$.data.gaps[?(@.skillName == 'MapSql')].weightPercent").value(60))
                .andExpect(jsonPath("$.data.assessedSkills").value(0))
                .andExpect(jsonPath("$.data.readinessPercent").value(0));

        // Old attempt history is preserved and still linked to career A.
        mockMvc.perform(get("/api/v1/students/me/attempts")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.attemptId == " + attemptId + ")].careerName").value("Map Career A"));

        // After switching, the new career's assessment can be started.
        mockMvc.perform(post("/api/v1/assessments/" + assessmentB.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("13. Admin-created published career with assessment becomes available with no code change")
    void adminCreatedCareer_becomesAvailable() throws Exception {
        String admin = adminToken();
        long skillId = createSkill(admin, "MapAdmin Skill", "PROGRAMMING_LANGUAGES");
        long careerId = createCareer(admin, "MapAdmin New Career", skillId);
        long assessmentId = createAssessment(admin, careerId, "MapAdmin Assessment");
        createQuestion(admin, assessmentId, skillId, "MapAdmin Q1");

        String student = register("map13@test.local");
        selectCareer(student, careerId);

        mockMvc.perform(get("/api/v1/assessments/" + careerId + "/available")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.assessmentId == " + assessmentId + ")]").isNotEmpty())
                .andExpect(jsonPath("$.data[0].questionCount").value(1));

        mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions.length()").value(1));
    }

    @Test
    @DisplayName("Draft career cannot be selected as a target")
    void draftCareer_rejectedAsTarget() throws Exception {
        String student = register("mapdraft@test.local");
        mockMvc.perform(put("/api/v1/students/me/career")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"careerId\": " + draftCareer.getId() + "}"))
                .andExpect(status().isNotFound());
    }

    // ---------- helpers ----------

    private Skill skill(String name, SkillCategory category) {
        return skillRepository.save(Skill.builder()
                .name(name).category(category).description(name).active(true).build());
    }

    private Career career(String name, boolean published) {
        return careerRepository.save(Career.builder()
                .name(name).description(name)
                .category(CareerCategory.SOFTWARE_DEVELOPMENT)
                .difficultyLevel(DifficultyLevel.INTERMEDIATE)
                .published(published).build());
    }

    private void framework(Career career, Skill skill, int weight, SkillLevel level, int target) {
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(skill)
                .weightPercent(weight).requiredLevel(level).targetPercent(target).build());
    }

    private AssessmentTest assessment(Career career, String title, boolean published) {
        return assessmentTestRepository.save(AssessmentTest.builder()
                .career(career).title(title).description(title)
                .durationMinutes(30).published(published).build());
    }

    private long question(AssessmentTest assessment, Skill skill, String text, int order) {
        return questionRepository.save(AssessmentQuestion.builder()
                .assessment(assessment).skill(skill)
                .questionText(text).questionType(QuestionType.MCQ)
                .difficulty(DifficultyLevel.INTERMEDIATE)
                .explanation("explanation")
                .displayOrder(order).active(true).build()).getId();
    }

    private long option(long questionId, String text, boolean correct) {
        AssessmentQuestion question = questionRepository.findById(questionId).orElseThrow();
        return optionRepository.save(QuestionOption.builder()
                .question(question).optionText(text)
                .correct(correct).displayOrder(correct ? 1 : 2).build()).getId();
    }

    private String register(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Mapping Student",
                                  "email": "%s",
                                  "mobile": "9876543219",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return TestSupport.token(reg, "accessToken");
    }

    private void selectCareer(String token, long careerId) throws Exception {
        mockMvc.perform(put("/api/v1/students/me/career")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"careerId\": " + careerId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetCareerId").value(careerId));
    }

    private long startAttempt(String token, long assessmentId) throws Exception {
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return mapper.readTree(start.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong();
    }

    private void answer(String token, long attemptId, long questionId, long optionId) throws Exception {
        mockMvc.perform(put("/api/v1/assessments/attempts/" + attemptId + "/answers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"questionId": %d, "optionId": %d}
                                """.formatted(questionId, optionId)))
                .andExpect(status().isOk());
    }

    private void submit(String token, long attemptId) throws Exception {
        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
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

    private long createSkill(String admin, String name, String category) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/skills")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"%s\", \"category\": \"%s\"}".formatted(name, category)))
                .andExpect(status().isOk())
                .andReturn();
        return parseId(result);
    }

    private long createCareer(String admin, String name, long skillId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/careers")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "%s",
                                  "description": "%s track",
                                  "category": "SOFTWARE_DEVELOPMENT",
                                  "difficultyLevel": "INTERMEDIATE",
                                  "published": true,
                                  "skills": [
                                    {"skillId": %d, "weightPercent": 100, "requiredLevel": "INTERMEDIATE"}
                                  ]
                                }
                                """.formatted(name, name, skillId)))
                .andExpect(status().isOk())
                .andReturn();
        return parseId(result);
    }

    private long createAssessment(String admin, long careerId, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/assessments")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "careerId": %d,
                                  "title": "%s",
                                  "description": "%s track assessment",
                                  "durationMinutes": 30,
                                  "published": true
                                }
                                """.formatted(careerId, title, title)))
                .andExpect(status().isOk())
                .andReturn();
        return parseId(result);
    }

    private void createQuestion(String admin, long assessmentId, long skillId, String text) throws Exception {
        mockMvc.perform(post("/api/v1/admin/assessments/" + assessmentId + "/questions")
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "assessmentId": %d,
                                  "skillId": %d,
                                  "questionText": "%s",
                                  "difficulty": "BEGINNER",
                                  "options": [
                                    {"optionText": "Right", "correct": true},
                                    {"optionText": "Wrong", "correct": false}
                                  ]
                                }
                                """.formatted(assessmentId, skillId, text)))
                .andExpect(status().isOk());
    }

    private long parseId(MvcResult result) throws Exception {
        JsonNode node = mapper.readTree(result.getResponse().getContentAsString());
        return node.path("data").path("id").asLong();
    }
}

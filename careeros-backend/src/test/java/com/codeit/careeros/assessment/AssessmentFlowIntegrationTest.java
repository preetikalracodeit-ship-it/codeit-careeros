package com.codeit.careeros.assessment;

import com.codeit.careeros.TestSupport;
import com.codeit.careeros.career.Career;
import com.codeit.careeros.career.CareerSkill;
import com.codeit.careeros.common.enums.CareerCategory;
import com.codeit.careeros.common.enums.DifficultyLevel;
import com.codeit.careeros.common.enums.QuestionType;
import com.codeit.careeros.common.enums.SkillLevel;
import com.codeit.careeros.repository.AssessmentAnswerRepository;
import com.codeit.careeros.repository.AssessmentAttemptRepository;
import com.codeit.careeros.repository.AssessmentQuestionRepository;
import com.codeit.careeros.repository.AssessmentTestRepository;
import com.codeit.careeros.repository.CareerRepository;
import com.codeit.careeros.repository.CareerSkillRepository;
import com.codeit.careeros.repository.QuestionOptionRepository;
import com.codeit.careeros.repository.SkillRepository;
import com.codeit.careeros.repository.SkillScoreRepository;
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

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AssessmentFlowIntegrationTest {

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

    private final ObjectMapper mapper = new ObjectMapper();

    private Long assessmentId;
    private Long careerId;
    private Long questionJavaCorrect;
    private Long questionJavaWrong;
    private Long questionSqlCorrect;
    private Long optionJava1;
    private Long optionJava2;
    private Long optionSql1;

    @BeforeEach
    void setUp() {
        skillScoreRepository.deleteAll();
        answerRepository.deleteAll();
        attemptRepository.deleteAll();
        optionRepository.deleteAll();
        questionRepository.deleteAll();
        assessmentTestRepository.deleteAll();
        careerSkillRepository.deleteAll();
        careerRepository.deleteAll();
        skillRepository.deleteAll();

        Skill java = skillRepository.save(Skill.builder()
                .name("Java").category(com.codeit.careeros.common.enums.SkillCategory.PROGRAMMING_LANGUAGES)
                .description("Java").active(true).build());
        Skill sql = skillRepository.save(Skill.builder()
                .name("SQL").category(com.codeit.careeros.common.enums.SkillCategory.DATABASES)
                .description("SQL").active(true).build());

        Career career = careerRepository.save(Career.builder()
                .name("Test Java Career").description("Test")
                .category(CareerCategory.SOFTWARE_DEVELOPMENT)
                .difficultyLevel(DifficultyLevel.INTERMEDIATE).published(true).build());
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(java).weightPercent(70)
                .requiredLevel(SkillLevel.INTERMEDIATE).targetPercent(80).build());
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(sql).weightPercent(30)
                .requiredLevel(SkillLevel.INTERMEDIATE).targetPercent(80).build());

        AssessmentTest assessment = assessmentTestRepository.save(AssessmentTest.builder()
                .career(career).title("Java Test Assessment").description("Test")
                .durationMinutes(30).published(true).build());
        careerId = career.getId();
        assessmentId = assessment.getId();

        AssessmentQuestion q1 = questionRepository.save(question(assessment, "Q1: Which keyword?", 1, java));
        AssessmentQuestion q2 = questionRepository.save(question(assessment, "Q2: Which operator?", 2, java));
        AssessmentQuestion q3 = questionRepository.save(question(assessment, "Q3: Which clause?", 3, sql));

        optionJava1 = saveOption(q1, 0, true, "final");
        optionJava2 = saveOption(q2, 0, true, "==");
        optionSql1 = saveOption(q3, 0, true, "WHERE");
        questionJavaCorrect = q1.getId();
        questionJavaWrong = q2.getId();
        questionSqlCorrect = q3.getId();
    }

    @Test
    @DisplayName("Student takes an assessment end to end with weighted scoring")
    void fullAssessmentFlow() throws Exception {
        String token = registerStudent("flow@test.local");

        mockMvc.perform(get("/api/v1/assessments/" + careerId + "/available")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].assessmentId").value(assessmentId))
                .andExpect(jsonPath("$.data[0].questionCount").value(3));

        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalQuestions").value(3))
                .andExpect(jsonPath("$.data.questions.length()").value(3))
                .andReturn();
        long attemptId = mapper.readTree(start.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong();

        MvcResult resumed = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(attemptId, mapper.readTree(resumed.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong(), "start resumes the in-progress attempt");

        saveAnswer(token, attemptId, questionJavaCorrect, optionJava1);
        saveAnswer(token, attemptId, questionSqlCorrect, optionSql1);

        mockMvc.perform(get("/api/v1/assessments/attempts/" + attemptId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.answeredQuestionIds.length()").value(2))
                .andExpect(jsonPath("$.data.questions.length()").value(3));

        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.overallScore").value(65))
                .andExpect(jsonPath("$.data.skills.length()").value(2))
                .andExpect(jsonPath("$.data.skills[0].scorePercent").value(50))
                .andExpect(jsonPath("$.data.skills[0].level").value("DEVELOPING"))
                .andExpect(jsonPath("$.data.skills[1].scorePercent").value(100))
                .andExpect(jsonPath("$.data.skills[1].level").value("STRONG"));

        mockMvc.perform(get("/api/v1/assessments/attempts/" + attemptId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.overallScore").value(65))
                .andExpect(jsonPath("$.data.questions").doesNotExist())
                .andExpect(jsonPath("$.data.skills.length()").value(2));

        mockMvc.perform(get("/api/v1/assessments/attempts/my")
                        .header("Authorization", "Bearer " + token)
                        .param("assessmentId", String.valueOf(assessmentId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));
    }

    @Test
    @DisplayName("Submit again and answers after submit are rejected")
    void submit_twiceIsRejected() throws Exception {
        String token = registerStudent("twice@test.local");
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data = mapper.readTree(start.getResponse().getContentAsString()).path("data");
        long attemptId = data.path("attemptId").asLong();

        saveAnswer(token, attemptId, questionJavaCorrect, optionJava1);
        saveAnswer(token, attemptId, questionJavaWrong, optionJava2);
        saveAnswer(token, attemptId, questionSqlCorrect, optionSql1);

        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallScore").value(Math.round((70f * 100 + 30f * 100) / 100)));

        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/v1/assessments/attempts/" + attemptId + "/answers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"questionId": %d, "optionId": %d}
                                """.formatted(questionSqlCorrect, optionSql1)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Starting again after submit creates a new attempt")
    void retakeCreatesNewAttempt() throws Exception {
        String token = registerStudent("retake@test.local");
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        long firstAttempt = mapper.readTree(start.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong();

        mockMvc.perform(post("/api/v1/assessments/attempts/" + firstAttempt + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        MvcResult retake = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        long secondAttempt = mapper.readTree(retake.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong();
        assertNotEquals(firstAttempt, secondAttempt, "retake must create a fresh attempt");
    }

    @Test
    @DisplayName("Student cannot access another student's attempt")
    void attemptIsOwnedByStudent() throws Exception {
        String owner = registerStudent("owner@test.local");
        String intruder = registerStudent("intruder@test.local");
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + owner))
                .andExpect(status().isOk())
                .andReturn();
        long attemptId = mapper.readTree(start.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong();

        mockMvc.perform(get("/api/v1/assessments/attempts/" + attemptId)
                        .header("Authorization", "Bearer " + intruder))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + intruder))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Same attempt keeps its shuffled question order on resume and refresh")
    void sameAttemptKeepsOrder() throws Exception {
        String token = registerStudent("order@test.local");
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data = mapper.readTree(start.getResponse().getContentAsString()).path("data");
        long attemptId = data.path("attemptId").asLong();
        List<Long> firstOrder = questionOrder(data);

        MvcResult resumed = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode resumedData = mapper.readTree(resumed.getResponse().getContentAsString()).path("data");
        assertEquals(attemptId, resumedData.path("attemptId").asLong());
        assertEquals(firstOrder, questionOrder(resumedData), "resume must keep the attempt's order");

        MvcResult state = mockMvc.perform(get("/api/v1/assessments/attempts/" + attemptId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(firstOrder,
                questionOrder(mapper.readTree(state.getResponse().getContentAsString()).path("data")),
                "refresh must keep the attempt's order");
    }

    private List<Long> questionOrder(JsonNode data) {
        List<Long> order = new java.util.ArrayList<>();
        for (JsonNode q : data.path("questions")) {
            order.add(q.path("questionId").asLong());
        }
        return order;
    }

    private String registerStudent(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Assessment Student",
                                  "email": "%s",
                                  "mobile": "9876543219",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return TestSupport.token(reg, "accessToken");
    }

    private void saveAnswer(String token, long attemptId, Long questionId, Long optionId) throws Exception {
        mockMvc.perform(put("/api/v1/assessments/attempts/" + attemptId + "/answers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"questionId": %d, "optionId": %d}
                                """.formatted(questionId, optionId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId));
    }

    private AssessmentQuestion question(AssessmentTest assessment, String text, int order, Skill skill) {
        return AssessmentQuestion.builder()
                .assessment(assessment)
                .skill(skill)
                .questionText(text)
                .questionType(QuestionType.MCQ)
                .difficulty(DifficultyLevel.INTERMEDIATE)
                .explanation("explanation")
                .displayOrder(order)
                .active(true)
                .build();
    }

    private Long saveOption(AssessmentQuestion question, int order, boolean correct, String text) {
        return optionRepository.save(com.codeit.careeros.assessment.QuestionOption.builder()
                .question(question)
                .optionText(text)
                .correct(correct)
                .displayOrder(order + 1)
                .build()).getId();
    }
}
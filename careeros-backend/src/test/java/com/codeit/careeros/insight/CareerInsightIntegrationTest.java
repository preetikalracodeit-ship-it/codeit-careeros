package com.codeit.careeros.insight;

import com.codeit.careeros.TestSupport;
import com.codeit.careeros.assessment.AssessmentQuestion;
import com.codeit.careeros.assessment.AssessmentTest;
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
import com.codeit.careeros.repository.QuestionOptionRepository;
import com.codeit.careeros.repository.SkillRepository;
import com.codeit.careeros.repository.SkillScoreRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.skill.Skill;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CareerInsightIntegrationTest {

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

    private final ObjectMapper mapper = new ObjectMapper();

    private Long assessmentId;
    private Long careerId;
    private Long questionJava1;
    private Long questionJava2;
    private Long questionSql1;
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
        studentProfileRepository.deleteAll();
        careerRepository.deleteAll();
        skillRepository.deleteAll();

        Skill java = skillRepository.save(Skill.builder()
                .name("Insight Java").category(SkillCategory.PROGRAMMING_LANGUAGES)
                .description("Java").active(true).build());
        Skill sql = skillRepository.save(Skill.builder()
                .name("Insight SQL").category(SkillCategory.DATABASES)
                .description("SQL").active(true).build());

        Career career = careerRepository.save(Career.builder()
                .name("Insight Career").description("Test")
                .category(CareerCategory.SOFTWARE_DEVELOPMENT)
                .difficultyLevel(DifficultyLevel.INTERMEDIATE).published(true).build());
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(java).weightPercent(70)
                .requiredLevel(SkillLevel.INTERMEDIATE).targetPercent(80).build());
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(sql).weightPercent(30)
                .requiredLevel(SkillLevel.BEGINNER).targetPercent(60).build());

        AssessmentTest assessment = assessmentTestRepository.save(AssessmentTest.builder()
                .career(career).title("Insight Assessment").description("Test")
                .durationMinutes(30).published(true).build());
        careerId = career.getId();
        assessmentId = assessment.getId();

        AssessmentQuestion q1 = questionRepository.save(question(assessment, "Q1 java?", 1, java));
        AssessmentQuestion q2 = questionRepository.save(question(assessment, "Q2 java?", 2, java));
        AssessmentQuestion q3 = questionRepository.save(question(assessment, "Q3 sql?", 3, sql));

        optionJava1 = saveOption(q1, true, "final");
        optionJava2 = saveOption(q2, true, "==");
        optionSql1 = saveOption(q3, true, "WHERE");
        questionJava1 = q1.getId();
        questionJava2 = q2.getId();
        questionSql1 = q3.getId();
    }

    @Test
    @DisplayName("Readiness without a target career returns an empty payload")
    void readiness_withoutTargetCareer_isEmpty() throws Exception {
        String token = registerStudent("notarget@test.local");

        mockMvc.perform(get("/api/v1/students/me/readiness")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(false))
                .andExpect(jsonPath("$.data.readinessPercent").value(0))
                .andExpect(jsonPath("$.data.gaps.length()").value(0));
    }

    @Test
    @DisplayName("Submit then readiness reports gaps, strengths and weighted readiness")
    void readiness_afterSubmit_reportsGapsAndReadiness() throws Exception {
        String token = registerStudent("insight@test.local");
        setTargetCareer(token);

        long attemptId = startAttempt(token);
        saveAnswer(token, attemptId, questionJava1, optionJava1);
        saveAnswer(token, attemptId, questionSql1, optionSql1);

        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Java 1/2 = 50 vs target 80 (gap -30); SQL 1/1 = 100 vs target 60 (gap +40).
        // Readiness = 100 * (70*50 + 30*60) / (70*80 + 30*60) = 72.
        mockMvc.perform(get("/api/v1/students/me/readiness")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(true))
                .andExpect(jsonPath("$.data.targetCareerId").value(careerId))
                .andExpect(jsonPath("$.data.readinessPercent").value(72))
                .andExpect(jsonPath("$.data.readinessLevel").value("GOOD"))
                .andExpect(jsonPath("$.data.totalSkills").value(2))
                .andExpect(jsonPath("$.data.assessedSkills").value(2))
                .andExpect(jsonPath("$.data.metSkills").value(1))
                .andExpect(jsonPath("$.data.submittedAttempts").value(1))
                .andExpect(jsonPath("$.data.latestAttempt.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.gaps.length()").value(2))
                .andExpect(jsonPath("$.data.strengths.length()").value(1))
                .andExpect(jsonPath("$.data.strengths[0].skillName").value("Insight SQL"))
                .andExpect(jsonPath("$.data.improvements.length()").value(1))
                .andExpect(jsonPath("$.data.improvements[0].skillName").value("Insight Java"))
                .andExpect(jsonPath("$.data.improvements[0].gapPercent").value(-30));
    }

    @Test
    @DisplayName("History lists submitted attempts newest first and is scoped to the owner")
    void history_listsSubmittedAttemptsNewestFirst() throws Exception {
        String owner = registerStudent("history@test.local");
        String other = registerStudent("history-other@test.local");
        setTargetCareer(owner);

        long first = startAttempt(owner);
        saveAnswer(owner, first, questionJava1, optionJava1);
        mockMvc.perform(post("/api/v1/assessments/attempts/" + first + "/submit")
                        .header("Authorization", "Bearer " + owner))
                .andExpect(status().isOk());

        long second = startAttempt(owner);
        saveAnswer(owner, second, questionJava1, optionJava1);
        saveAnswer(owner, second, questionJava2, optionJava2);
        saveAnswer(owner, second, questionSql1, optionSql1);
        mockMvc.perform(post("/api/v1/assessments/attempts/" + second + "/submit")
                        .header("Authorization", "Bearer " + owner))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/students/me/attempts")
                        .header("Authorization", "Bearer " + owner)
                        .param("assessmentId", String.valueOf(assessmentId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].attemptId").value(second))
                .andExpect(jsonPath("$.data[1].attemptId").value(first));

        mockMvc.perform(get("/api/v1/students/me/attempts")
                        .header("Authorization", "Bearer " + other))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));

        mockMvc.perform(get("/api/v1/students/me/readiness"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/students/me/attempts"))
                .andExpect(status().isUnauthorized());
    }

    private String registerStudent(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Insight Student",
                                  "email": "%s",
                                  "mobile": "9876543219",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return TestSupport.token(reg, "accessToken");
    }

    private void setTargetCareer(String token) throws Exception {
        mockMvc.perform(put("/api/v1/students/me/career")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"careerId": %d}
                                """.formatted(careerId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetCareerId").value(careerId));
    }

    private long startAttempt(String token) throws Exception {
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return mapper.readTree(start.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong();
    }

    private void saveAnswer(String token, long attemptId, Long questionId, Long optionId) throws Exception {
        mockMvc.perform(put("/api/v1/assessments/attempts/" + attemptId + "/answers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"questionId": %d, "optionId": %d}
                                """.formatted(questionId, optionId)))
                .andExpect(status().isOk());
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

    private Long saveOption(AssessmentQuestion question, boolean correct, String text) {
        return optionRepository.save(com.codeit.careeros.assessment.QuestionOption.builder()
                .question(question)
                .optionText(text)
                .correct(correct)
                .displayOrder(1)
                .build()).getId();
    }
}

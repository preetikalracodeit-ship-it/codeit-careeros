package com.codeit.careeros.assessment;

import com.codeit.careeros.TestSupport;
import com.codeit.careeros.career.Career;
import com.codeit.careeros.common.enums.AttemptStatus;
import com.codeit.careeros.common.enums.CareerCategory;
import com.codeit.careeros.common.enums.DifficultyLevel;
import com.codeit.careeros.common.enums.QuestionType;
import com.codeit.careeros.common.enums.SkillCategory;
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

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Server-side enforcement of the attempt duration: once the deadline stored
 * on the attempt passes, answers and submissions are rejected (410) and the
 * attempt moves to the terminal EXPIRED state.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AssessmentExpiryIntegrationTest {

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
    private Long questionId;
    private Long optionId;

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

        Skill skill = skillRepository.save(Skill.builder()
                .name("Expiry Skill").category(SkillCategory.PROGRAMMING_LANGUAGES)
                .description("Expiry").active(true).build());
        Career career = careerRepository.save(Career.builder()
                .name("Expiry Career").description("Expiry")
                .category(CareerCategory.SOFTWARE_DEVELOPMENT)
                .difficultyLevel(DifficultyLevel.BEGINNER).published(true).build());
        AssessmentTest assessment = assessmentTestRepository.save(AssessmentTest.builder()
                .career(career).title("Expiry Assessment").description("Expiry")
                .durationMinutes(30).published(true).build());
        assessmentId = assessment.getId();

        AssessmentQuestion question = questionRepository.save(AssessmentQuestion.builder()
                .assessment(assessment).skill(skill)
                .questionText("Expiry Q1?").questionType(QuestionType.MCQ)
                .difficulty(DifficultyLevel.BEGINNER).displayOrder(1).active(true).build());
        questionId = question.getId();
        optionId = optionRepository.save(QuestionOption.builder()
                .question(question).optionText("yes").correct(true).displayOrder(1).build()).getId();
        optionRepository.save(QuestionOption.builder()
                .question(question).optionText("no").correct(false).displayOrder(2).build());
    }

    @Test
    @DisplayName("Start response carries the server-computed deadline")
    void start_includesExpiresAt() throws Exception {
        String token = registerStudent("deadline@test.local");
        mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.expiresAt").exists())
                .andExpect(jsonPath("$.data.questions[0].selectedOptionId").doesNotExist());
    }

    @Test
    @DisplayName("Autosave after the deadline is rejected and the attempt expires")
    void saveAnswer_afterExpiry_isRejected() throws Exception {
        String token = registerStudent("late-answer@test.local");
        long attemptId = startAttempt(token);
        forceExpiry(attemptId);

        mockMvc.perform(put("/api/v1/assessments/attempts/" + attemptId + "/answers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"questionId": %d, "optionId": %d}
                                """.formatted(questionId, optionId)))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.errorCode").value("ATTEMPT_EXPIRED"));

        AssessmentAttempt attempt = attemptRepository.findById(attemptId).orElseThrow();
        assertEquals(AttemptStatus.EXPIRED, attempt.getStatus());
    }

    @Test
    @DisplayName("Submit after the deadline is rejected and the attempt expires")
    void submit_afterExpiry_isRejected() throws Exception {
        String token = registerStudent("late-submit@test.local");
        long attemptId = startAttempt(token);
        forceExpiry(attemptId);

        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.errorCode").value("ATTEMPT_EXPIRED"));

        mockMvc.perform(get("/api/v1/assessments/attempts/" + attemptId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("EXPIRED"));
    }

    @Test
    @DisplayName("Expired attempt cannot be submitted again and a fresh start creates a new attempt")
    void start_afterExpiry_createsNewAttempt() throws Exception {
        String token = registerStudent("reenter@test.local");
        long firstAttempt = startAttempt(token);
        forceExpiry(firstAttempt);

        mockMvc.perform(post("/api/v1/assessments/attempts/" + firstAttempt + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isGone());

        MvcResult retake = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions.length()").value(1))
                .andReturn();
        long secondAttempt = mapper.readTree(retake.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong();
        assertNotEquals(firstAttempt, secondAttempt, "expired attempt must not be resumed");
        assertNotNull(attemptRepository.findById(secondAttempt).orElseThrow().getExpiresAt());
    }

    private long startAttempt(String token) throws Exception {
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return mapper.readTree(start.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong();
    }

    private void forceExpiry(long attemptId) {
        AssessmentAttempt attempt = attemptRepository.findById(attemptId).orElseThrow();
        attempt.setExpiresAt(Instant.now().minusSeconds(60));
        attemptRepository.save(attempt);
    }

    private String registerStudent(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Expiry Student",
                                  "email": "%s",
                                  "mobile": "9876543220",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return TestSupport.token(reg, "accessToken");
    }
}

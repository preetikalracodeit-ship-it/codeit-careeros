package com.codeit.careeros.progress;

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
class ProgressIntegrationTest {

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
    private Long careerId;
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
        studentProfileRepository.deleteAll();
        careerRepository.deleteAll();
        skillRepository.deleteAll();

        Skill skill = skillRepository.save(Skill.builder()
                .name("Progress Java").category(SkillCategory.PROGRAMMING_LANGUAGES)
                .description("Java").active(true).build());
        Career career = careerRepository.save(Career.builder()
                .name("Progress Career").description("Test")
                .category(CareerCategory.SOFTWARE_DEVELOPMENT)
                .difficultyLevel(DifficultyLevel.INTERMEDIATE).published(true).build());
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(skill).weightPercent(100)
                .requiredLevel(SkillLevel.INTERMEDIATE).targetPercent(80).build());
        AssessmentTest assessment = assessmentTestRepository.save(AssessmentTest.builder()
                .career(career).title("Progress Assessment").description("Test")
                .durationMinutes(30).published(true).build());
        careerId = career.getId();
        assessmentId = assessment.getId();
        AssessmentQuestion q = questionRepository.save(AssessmentQuestion.builder()
                .assessment(assessment).skill(skill).questionText("Q1?")
                .questionType(QuestionType.MCQ).difficulty(DifficultyLevel.INTERMEDIATE)
                .explanation("exp").displayOrder(1).active(true).build());
        questionId = q.getId();
        optionId = optionRepository.save(com.codeit.careeros.assessment.QuestionOption.builder()
                .question(q).optionText("ok").correct(true).displayOrder(1).build()).getId();
    }

    @Test
    @DisplayName("Progress without target returns empty sections, no invented data")
    void progress_withoutTarget_isEmpty() throws Exception {
        String token = registerStudent("progress-empty@test.local");
        mockMvc.perform(get("/api/v1/progress/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.readiness.hasTarget").value(false))
                .andExpect(jsonPath("$.data.completedAssessments").value(0))
                .andExpect(jsonPath("$.data.roadmap.hasTarget").value(false))
                .andExpect(jsonPath("$.data.projects.hasTarget").value(false))
                .andExpect(jsonPath("$.data.cv.hasCv").value(false))
                .andExpect(jsonPath("$.data.linkedIn.hasProfile").value(false))
                .andExpect(jsonPath("$.data.recentActivity").isArray());
    }

    @Test
    @DisplayName("Progress aggregates readiness, attempts, roadmap and projects after submit")
    void progress_afterSubmit_aggregates() throws Exception {
        String token = registerStudent("progress-full@test.local");
        setTargetCareer(token);
        long attemptId = startAttempt(token);
        saveAnswer(token, attemptId);
        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/progress/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.readiness.hasTarget").value(true))
                .andExpect(jsonPath("$.data.readiness.gaps.length()").value(1))
                .andExpect(jsonPath("$.data.completedAssessments").value(1))
                .andExpect(jsonPath("$.data.latestAttempt.attemptId").value(attemptId))
                .andExpect(jsonPath("$.data.roadmap.hasTarget").value(true))
                .andExpect(jsonPath("$.data.projects.hasTarget").value(true))
                .andExpect(jsonPath("$.data.recentActivity.length()").value(1))
                .andExpect(jsonPath("$.data.recentActivity[0].type").value("ASSESSMENT"));
    }

    @Test
    @DisplayName("Progress is owner-scoped and requires authentication")
    void progress_ownership() throws Exception {
        String owner = registerStudent("progress-owner@test.local");
        String other = registerStudent("progress-other@test.local");
        setTargetCareer(owner);
        long attemptId = startAttempt(owner);
        saveAnswer(owner, attemptId);
        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + owner))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/progress/me")
                        .header("Authorization", "Bearer " + other))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.completedAssessments").value(0));

        mockMvc.perform(get("/api/v1/progress/me"))
                .andExpect(status().isUnauthorized());
    }

    private String registerStudent(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName": "Progress Student", "email": "%s", "mobile": "9876543219", "password": "Password1", "termsAccepted": true}
                                """.formatted(email)))
                .andExpect(status().isCreated()).andReturn();
        return TestSupport.token(reg, "accessToken");
    }

    private void setTargetCareer(String token) throws Exception {
        mockMvc.perform(put("/api/v1/students/me/career")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(""" 
                                {"careerId": %d}
                                """.formatted(careerId)))
                .andExpect(status().isOk());
    }

    private long startAttempt(String token) throws Exception {
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        return mapper.readTree(start.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong();
    }

    private void saveAnswer(String token, long attemptId) throws Exception {
        mockMvc.perform(put("/api/v1/assessments/attempts/" + attemptId + "/answers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"questionId": %d, "optionId": %d}
                                """.formatted(questionId, optionId)))
                .andExpect(status().isOk());
    }
}

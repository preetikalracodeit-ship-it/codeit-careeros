package com.codeit.careeros.report;

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

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReportIntegrationTest {

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
                .name("Report Java").category(SkillCategory.PROGRAMMING_LANGUAGES)
                .description("Java").active(true).build());
        Career career = careerRepository.save(Career.builder()
                .name("Report Career").description("Test")
                .category(CareerCategory.SOFTWARE_DEVELOPMENT)
                .difficultyLevel(DifficultyLevel.INTERMEDIATE).published(true).build());
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(skill).weightPercent(100)
                .requiredLevel(SkillLevel.INTERMEDIATE).targetPercent(80).build());
        AssessmentTest assessment = assessmentTestRepository.save(AssessmentTest.builder()
                .career(career).title("Report Assessment").description("Test")
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
    @DisplayName("Report list reflects live data; missing data is reported, not invented")
    void list_reflectsLiveData() throws Exception {
        String token = registerStudent("report-list@test.local");
        mockMvc.perform(get("/api/v1/reports")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(5))
                .andExpect(jsonPath("$.data[0].available").value(false));

        setTargetCareer(token);
        long attemptId = startAttempt(token);
        saveAnswer(token, attemptId);
        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/reports")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.type=='readiness')].available").value(true))
                .andExpect(jsonPath("$.data[?(@.type=='assessment')].available").value(true))
                .andExpect(jsonPath("$.data[?(@.type=='gap-analysis')].available").value(true));
    }

    @Test
    @DisplayName("Readiness/assessment/gap/roadmap/overall JSON endpoints return live data")
    void jsonEndpoints_returnLiveData() throws Exception {
        String token = registerStudent("report-json@test.local");
        setTargetCareer(token);
        long attemptId = startAttempt(token);
        saveAnswer(token, attemptId);
        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/reports/readiness")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(true))
                .andExpect(jsonPath("$.data.gaps.length()").value(1));

        mockMvc.perform(get("/api/v1/reports/assessment")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attempts.length()").value(1))
                .andExpect(jsonPath("$.data.latestSkillScores.length()").value(1));

        mockMvc.perform(get("/api/v1/reports/gap-analysis")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gaps.length()").value(1));

        mockMvc.perform(get("/api/v1/reports/roadmap")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(true));

        mockMvc.perform(get("/api/v1/reports/overall")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.student.email").value("report-json@test.local"))
                .andExpect(jsonPath("$.data.recommendedNextSteps").isArray());
    }

    @Test
    @DisplayName("PDF downloads are real PDFs from live data and owner-scoped")
    void pdfDownload_isRealPdf() throws Exception {
        String token = registerStudent("report-pdf@test.local");
        setTargetCareer(token);
        long attemptId = startAttempt(token);
        saveAnswer(token, attemptId);
        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        MvcResult pdf = mockMvc.perform(get("/api/v1/reports/overall/download")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", containsString("careeros-overall-report.pdf")))
                .andReturn();
        byte[] bytes = pdf.getResponse().getContentAsByteArray();
        String header = new String(bytes, 0, Math.min(5, bytes.length));
        org.junit.jupiter.api.Assertions.assertEquals("%PDF-", header);

        mockMvc.perform(get("/api/v1/reports/overall/download"))
                .andExpect(status().isUnauthorized());

        String other = registerStudent("report-pdf-other@test.local");
        mockMvc.perform(get("/api/v1/reports/readiness")
                        .header("Authorization", "Bearer " + other))
                .andExpect(status().isBadRequest());
    }

    private String registerStudent(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName": "Report Student", "email": "%s", "mobile": "9876543219", "password": "Password1", "termsAccepted": true}
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

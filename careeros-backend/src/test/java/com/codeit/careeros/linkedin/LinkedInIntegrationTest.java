package com.codeit.careeros.linkedin;

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
import com.codeit.careeros.repository.CvDocumentRepository;
import com.codeit.careeros.repository.LinkedInProfileRepository;
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
class LinkedInIntegrationTest {

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
    private CvDocumentRepository cvDocumentRepository;

    @Autowired
    private LinkedInProfileRepository linkedInProfileRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    private Long careerId;
    private Long assessmentId;
    private Long questionJava1;
    private Long optionJava1;

    @BeforeEach
    void setUp() {
        linkedInProfileRepository.deleteAll();
        cvDocumentRepository.deleteAll();
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
                .name("Linked Java").category(SkillCategory.PROGRAMMING_LANGUAGES)
                .description("Java").active(true).build());
        Skill docker = skillRepository.save(Skill.builder()
                .name("Linked Docker").category(SkillCategory.CLOUD)
                .description("Docker").active(true).build());
        Skill git = skillRepository.save(Skill.builder()
                .name("Linked Git").category(SkillCategory.DEVOPS)
                .description("Git").active(true).build());
        Skill python = skillRepository.save(Skill.builder()
                .name("Linked Python").category(SkillCategory.PROGRAMMING_LANGUAGES)
                .description("Python").active(true).build());

        Career career = careerRepository.save(Career.builder()
                .name("Linked Career").description("Test")
                .category(CareerCategory.SOFTWARE_DEVELOPMENT)
                .difficultyLevel(DifficultyLevel.INTERMEDIATE).published(true).build());
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(java).weightPercent(70)
                .requiredLevel(SkillLevel.INTERMEDIATE).targetPercent(80).build());
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(docker).weightPercent(30)
                .requiredLevel(SkillLevel.BEGINNER).targetPercent(60).build());
        careerId = career.getId();

        AssessmentTest assessment = assessmentTestRepository.save(AssessmentTest.builder()
                .career(career).title("Linked Assessment").description("Test")
                .durationMinutes(30).published(true).build());
        assessmentId = assessment.getId();

        AssessmentQuestion q1 = questionRepository.save(AssessmentQuestion.builder()
                .assessment(assessment).skill(java).questionText("Q1 java?")
                .questionType(QuestionType.MCQ).difficulty(DifficultyLevel.INTERMEDIATE)
                .explanation("exp").displayOrder(1).active(true).build());
        questionJava1 = q1.getId();
        optionJava1 = optionRepository.save(com.codeit.careeros.assessment.QuestionOption.builder()
                .question(q1).optionText("final").correct(true).displayOrder(1).build()).getId();
    }

    @Test
    @DisplayName("Invalid LinkedIn URLs are rejected, valid ones saved and replaced")
    void urlValidation_saveAndReplace() throws Exception {
        String token = registerStudent("li-url@test.local");

        mockMvc.perform(put("/api/v1/linkedin")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"profileUrl": "https://example.com/in/someone"}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/v1/linkedin")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"profileUrl": "not a url at all"}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/v1/linkedin")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profileUrl": "https://www.linkedin.com/in/jane-dev",
                                  "headline": "Aspiring Java Developer",
                                  "about": "Computer science student who loves building Java backends.",
                                  "skillsText": "Linked Java, Git"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profileUrl").value("https://www.linkedin.com/in/jane-dev"))
                .andExpect(jsonPath("$.data.headline").value("Aspiring Java Developer"));

        mockMvc.perform(get("/api/v1/linkedin/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profileUrl").value("https://www.linkedin.com/in/jane-dev"));

        // Replace with an updated import.
        mockMvc.perform(put("/api/v1/linkedin")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profileUrl": "www.linkedin.com/in/jane-dev-2",
                                  "headline": "Java Developer Intern"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profileUrl").value("https://www.linkedin.com/in/jane-dev-2"))
                .andExpect(jsonPath("$.data.headline").value("Java Developer Intern"))
                .andExpect(jsonPath("$.data.about").doesNotExist());

        mockMvc.perform(put("/api/v1/linkedin"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Analysis without profile is empty; with profile compares against target career")
    void analysis_emptyThenCareerComparison() throws Exception {
        String token = registerStudent("li-analysis@test.local");

        mockMvc.perform(get("/api/v1/linkedin/analysis")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasProfile").value(false));

        setTargetCareer(token);
        submitAssessment(token);
        saveProfile(token);

        // Linked Java assessed 100 vs target 80 (matched); Linked Docker absent (missing).
        mockMvc.perform(get("/api/v1/linkedin/analysis")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasProfile").value(true))
                .andExpect(jsonPath("$.data.hasTarget").value(true))
                .andExpect(jsonPath("$.data.alignmentPercent").value(50))
                .andExpect(jsonPath("$.data.detectedSkills[?(@.skillName == 'Linked Java')]").exists())
                .andExpect(jsonPath("$.data.matchedSkills.length()").value(1))
                .andExpect(jsonPath("$.data.matchedSkills[0].skillName").value("Linked Java"))
                .andExpect(jsonPath("$.data.matchedSkills[0].scorePercent").value(100))
                .andExpect(jsonPath("$.data.missingSkills.length()").value(1))
                .andExpect(jsonPath("$.data.missingSkills[0].skillName").value("Linked Docker"))
                .andExpect(jsonPath("$.data.completenessPercent").value(83))
                .andExpect(jsonPath("$.data.suggestions[?(@ =~ /.*Linked Docker.*/)]").exists());
    }

    @Test
    @DisplayName("Students can only ever see their own LinkedIn data")
    void ownership_enforced() throws Exception {
        String owner = registerStudent("li-owner@test.local");
        String other = registerStudent("li-other@test.local");
        saveProfile(owner);

        mockMvc.perform(get("/api/v1/linkedin/me")
                        .header("Authorization", "Bearer " + other))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist());
        mockMvc.perform(get("/api/v1/linkedin/analysis")
                        .header("Authorization", "Bearer " + other))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasProfile").value(false));

        mockMvc.perform(get("/api/v1/linkedin/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/linkedin/analysis")).andExpect(status().isUnauthorized());
    }

    private String registerStudent(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Linked Student",
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
                .andExpect(status().isOk());
    }

    private void submitAssessment(String token) throws Exception {
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        long attemptId = mapper.readTree(start.getResponse().getContentAsString())
                .path("data").path("attemptId").asLong();
        mockMvc.perform(put("/api/v1/assessments/attempts/" + attemptId + "/answers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"questionId": %d, "optionId": %d}
                                """.formatted(questionJava1, optionJava1)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    private void saveProfile(String token) throws Exception {
        mockMvc.perform(put("/api/v1/linkedin")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profileUrl": "https://www.linkedin.com/in/linked-student",
                                  "headline": "Aspiring Java Developer building Spring backends",
                                  "about": "Final year computer science student. I build REST APIs with Linked Java and package them for deployment. Looking for backend internships where I can learn from senior engineers and grow every week.",
                                  "currentRole": "Backend Intern",
                                  "experienceText": "Backend Intern at TestCorp: built REST endpoints with Linked Java.",
                                  "skillsText": "Linked Java, Git, Communication, Python",
                                  "educationText": "B.Tech Computer Science, Test College 2025"
                                }
                                """))
                .andExpect(status().isOk());
    }
}

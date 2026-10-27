package com.codeit.careeros.roadmap;

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
import com.codeit.careeros.project.Project;
import com.codeit.careeros.project.ProjectSkill;
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
class RoadmapProjectIntegrationTest {

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
    private RoadmapPhaseRepository phaseRepository;

    @Autowired
    private RoadmapItemRepository itemRepository;

    @Autowired
    private RoadmapItemProgressRepository roadmapProgressRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectSkillRepository projectSkillRepository;

    @Autowired
    private ProjectProgressRepository projectProgressRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    private Long careerId;
    private Long assessmentId;
    private Long questionJava1;
    private Long questionJava2;
    private Long questionSql1;
    private Long optionJava1;
    private Long optionSql1;
    private Long itemJavaId;
    private Long itemSqlId;
    private Long itemGeneralId;
    private Long projectId;
    private Long draftProjectId;

    @BeforeEach
    void setUp() {
        roadmapProgressRepository.deleteAll();
        itemRepository.deleteAll();
        phaseRepository.deleteAll();
        projectProgressRepository.deleteAll();
        projectSkillRepository.deleteAll();
        projectRepository.deleteAll();
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
                .name("Roadmap Java").category(SkillCategory.PROGRAMMING_LANGUAGES)
                .description("Java").active(true).build());
        Skill sql = skillRepository.save(Skill.builder()
                .name("Roadmap SQL").category(SkillCategory.DATABASES)
                .description("SQL").active(true).build());

        Career career = careerRepository.save(Career.builder()
                .name("Roadmap Career").description("Test")
                .category(CareerCategory.SOFTWARE_DEVELOPMENT)
                .difficultyLevel(DifficultyLevel.INTERMEDIATE).published(true).build());
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(java).weightPercent(70)
                .requiredLevel(SkillLevel.INTERMEDIATE).targetPercent(80).build());
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(sql).weightPercent(30)
                .requiredLevel(SkillLevel.BEGINNER).targetPercent(60).build());
        careerId = career.getId();

        AssessmentTest assessment = assessmentTestRepository.save(AssessmentTest.builder()
                .career(career).title("Roadmap Assessment").description("Test")
                .durationMinutes(30).published(true).build());
        assessmentId = assessment.getId();

        AssessmentQuestion q1 = questionRepository.save(question(assessment, "Q1 java?", 1, java));
        AssessmentQuestion q2 = questionRepository.save(question(assessment, "Q2 java?", 2, java));
        AssessmentQuestion q3 = questionRepository.save(question(assessment, "Q3 sql?", 3, sql));
        optionJava1 = saveOption(q1, true);
        saveOption(q2, true);
        optionSql1 = saveOption(q3, true);
        questionJava1 = q1.getId();
        questionJava2 = q2.getId();
        questionSql1 = q3.getId();

        RoadmapPhase phaseOne = phaseRepository.save(RoadmapPhase.builder()
                .career(career).title("Foundation").description("Basics")
                .displayOrder(1).durationDays(30).build());
        RoadmapPhase phaseTwo = phaseRepository.save(RoadmapPhase.builder()
                .career(career).title("Builder").description("Practice")
                .displayOrder(2).durationDays(30).build());
        itemJavaId = itemRepository.save(RoadmapItem.builder()
                .phase(phaseOne).skill(java).title("Java essentials").description("Learn Java")
                .learningGoal("Reach 80%").displayOrder(1).estimatedHours(10).build()).getId();
        itemSqlId = itemRepository.save(RoadmapItem.builder()
                .phase(phaseOne).skill(sql).title("SQL essentials").description("Learn SQL")
                .learningGoal("Reach 60%").displayOrder(2).estimatedHours(8).build()).getId();
        itemGeneralId = itemRepository.save(RoadmapItem.builder()
                .phase(phaseTwo).title("Capstone review").description("Combine everything")
                .learningGoal("Build end to end").displayOrder(1).estimatedHours(12).build()).getId();

        projectId = projectRepository.save(Project.builder()
                .career(career).title("Starter Project").description("First build")
                .difficulty(DifficultyLevel.BEGINNER).estimatedWeeks(2)
                .displayOrder(1).published(true).build()).getId();
        projectSkillRepository.save(ProjectSkill.builder()
                .project(projectRepository.findById(projectId).orElseThrow())
                .skill(java).build());
        draftProjectId = projectRepository.save(Project.builder()
                .career(career).title("Draft Project").description("Unpublished")
                .difficulty(DifficultyLevel.ADVANCED).estimatedWeeks(4)
                .displayOrder(2).published(false).build()).getId();
    }

    @Test
    @DisplayName("Roadmap and projects without a target career return empty payloads")
    void withoutTargetCareer_isEmpty() throws Exception {
        String token = registerStudent("s4-notarget@test.local");

        mockMvc.perform(get("/api/v1/roadmaps/my")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(false))
                .andExpect(jsonPath("$.data.phases.length()").value(0));

        mockMvc.perform(get("/api/v1/projects/recommended")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(false))
                .andExpect(jsonPath("$.data.projects.length()").value(0));
    }

    @Test
    @DisplayName("Roadmap reports phases with live gaps and tracks item progress")
    void roadmap_reportsGapsAndTracksProgress() throws Exception {
        String token = registerStudent("s4-roadmap@test.local");
        setTargetCareer(token);
        submitAssessment(token, false);

        // Java 1/2 = 50 vs target 80 (gap -30); SQL 0/1 = 0 vs target 60 (gap -60).
        mockMvc.perform(get("/api/v1/roadmaps/my")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(true))
                .andExpect(jsonPath("$.data.careerId").value(careerId))
                .andExpect(jsonPath("$.data.totalItems").value(3))
                .andExpect(jsonPath("$.data.completedItems").value(0))
                .andExpect(jsonPath("$.data.progressPercent").value(0))
                .andExpect(jsonPath("$.data.phases.length()").value(2))
                .andExpect(jsonPath("$.data.phases[0].items.length()").value(2))
                .andExpect(jsonPath("$.data.phases[0].items[0].skillName").value("Roadmap Java"))
                .andExpect(jsonPath("$.data.phases[0].items[0].assessed").value(true))
                .andExpect(jsonPath("$.data.phases[0].items[0].scorePercent").value(50))
                .andExpect(jsonPath("$.data.phases[0].items[0].gapPercent").value(-30))
                .andExpect(jsonPath("$.data.phases[0].items[0].status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.data.phases[1].items[0].skillId").doesNotExist())
                .andExpect(jsonPath("$.data.phases[1].items[0].assessed").value(false));

        mockMvc.perform(put("/api/v1/roadmaps/items/" + itemJavaId + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"IN_PROGRESS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));

        mockMvc.perform(put("/api/v1/roadmaps/items/" + itemJavaId + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"COMPLETED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        // 1 of 3 items completed -> 33%.
        mockMvc.perform(get("/api/v1/roadmaps/my")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.completedItems").value(1))
                .andExpect(jsonPath("$.data.inProgressItems").value(0))
                .andExpect(jsonPath("$.data.progressPercent").value(33))
                .andExpect(jsonPath("$.data.phases[0].completedItems").value(1));

        mockMvc.perform(put("/api/v1/roadmaps/items/999999/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"COMPLETED\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(put("/api/v1/roadmaps/items/" + itemSqlId + "/status")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"ALMOST\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/roadmaps/my"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Projects recommend published only, enrich skill gaps and track progress per student")
    void projects_recommendAndTrackProgress() throws Exception {
        String owner = registerStudent("s4-projects@test.local");
        String other = registerStudent("s4-projects-other@test.local");
        setTargetCareer(owner);
        submitAssessment(owner, true);

        // Java 2/2 = 100 vs target 80 (gap +20).
        mockMvc.perform(get("/api/v1/projects/recommended")
                        .header("Authorization", "Bearer " + owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(true))
                .andExpect(jsonPath("$.data.totalProjects").value(1))
                .andExpect(jsonPath("$.data.projects[0].projectId").value(projectId))
                .andExpect(jsonPath("$.data.projects[0].status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.data.projects[0].skills.length()").value(1))
                .andExpect(jsonPath("$.data.projects[0].skills[0].skillName").value("Roadmap Java"))
                .andExpect(jsonPath("$.data.projects[0].skills[0].scorePercent").value(100))
                .andExpect(jsonPath("$.data.projects[0].skills[0].gapPercent").value(20));

        mockMvc.perform(put("/api/v1/projects/" + projectId + "/status")
                        .header("Authorization", "Bearer " + owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"COMPLETED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.skills[0].assessed").value(true));

        mockMvc.perform(get("/api/v1/projects/recommended")
                        .header("Authorization", "Bearer " + owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.completedProjects").value(1));

        // Other student (no target career set, no progress) is unaffected.
        mockMvc.perform(get("/api/v1/projects/recommended")
                        .header("Authorization", "Bearer " + other))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(false));

        mockMvc.perform(put("/api/v1/projects/" + draftProjectId + "/status")
                        .header("Authorization", "Bearer " + owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"IN_PROGRESS\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/projects/999999/status")
                        .header("Authorization", "Bearer " + owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"COMPLETED\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/projects/recommended"))
                .andExpect(status().isUnauthorized());
    }

    private String registerStudent(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Sprint Four Student",
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

    /** Submits the assessment; when answerAllJava, both Java questions are answered correctly. */
    private void submitAssessment(String token, boolean answerAllJava) throws Exception {
        long attemptId = startAttempt(token);
        saveAnswer(token, attemptId, questionJava1, optionJava1);
        if (answerAllJava) {
            saveAnswer(token, attemptId, questionJava2,
                    optionRepository.findAll().stream()
                            .filter(o -> o.getQuestion().getId().equals(questionJava2)
                                    && o.isCorrect())
                            .findFirst().orElseThrow().getId());
            saveAnswer(token, attemptId, questionSql1, optionSql1);
        }
        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
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

    private Long saveOption(AssessmentQuestion question, boolean correct) {
        return optionRepository.save(com.codeit.careeros.assessment.QuestionOption.builder()
                .question(question)
                .optionText("option")
                .correct(correct)
                .displayOrder(1)
                .build()).getId();
    }
}

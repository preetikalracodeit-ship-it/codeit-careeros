package com.codeit.careeros.assessment;

import com.codeit.careeros.TestSupport;
import com.codeit.careeros.career.Career;
import com.codeit.careeros.career.CareerSkill;
import com.codeit.careeros.common.enums.CareerCategory;
import com.codeit.careeros.common.enums.DifficultyLevel;
import com.codeit.careeros.common.enums.QuestionType;
import com.codeit.careeros.common.enums.SkillCategory;
import com.codeit.careeros.common.enums.SkillLevel;
import com.codeit.careeros.repository.AssessmentAnswerRepository;
import com.codeit.careeros.repository.AssessmentAttemptQuestionRepository;
import com.codeit.careeros.repository.AssessmentAttemptRepository;
import com.codeit.careeros.repository.AssessmentQuestionRepository;
import com.codeit.careeros.repository.AssessmentTestRepository;
import com.codeit.careeros.repository.CareerRepository;
import com.codeit.careeros.repository.CareerSkillRepository;
import com.codeit.careeros.repository.ProjectProgressRepository;
import com.codeit.careeros.repository.ProjectRepository;
import com.codeit.careeros.repository.ProjectSkillRepository;
import com.codeit.careeros.repository.QuestionOptionRepository;
import com.codeit.careeros.repository.SkillRepository;
import com.codeit.careeros.repository.SkillScoreRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.service.AssessmentService;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sprint 9 dynamic assessment selection: career-specific banks, randomized
 * per-attempt subsets weighted by the live competency framework, unseen
 * questions preferred across retakes, frozen per-attempt sets, and answers
 * plus scoring that keep working on subsets — with correct answers never
 * leaving the server.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AssessmentRandomizationIntegrationTest {

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
    private AssessmentAttemptQuestionRepository attemptQuestionRepository;

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

    private final ObjectMapper mapper = new ObjectMapper();

    private Career careerA;
    private Career careerB;
    private AssessmentTest assessmentA;
    private AssessmentTest assessmentB;
    private final Map<Long, Long> correctOptionByQuestion = new HashMap<>();
    private final Map<Long, String> skillNameByQuestion = new HashMap<>();

    @BeforeEach
    void setUp() {
        skillScoreRepository.deleteAll();
        answerRepository.deleteAll();
        attemptQuestionRepository.deleteAll();
        attemptRepository.deleteAll();
        List<com.codeit.careeros.entity.StudentProfile> profiles = studentProfileRepository.findAll();
        profiles.forEach(p -> p.setTargetCareer(null));
        studentProfileRepository.saveAll(profiles);
        optionRepository.deleteAll();
        questionRepository.deleteAll();
        assessmentTestRepository.deleteAll();
        careerSkillRepository.deleteAll();
        projectProgressRepository.deleteAll();
        projectSkillRepository.deleteAll();
        projectRepository.deleteAll();
        careerRepository.deleteAll();
        skillRepository.deleteAll();
        correctOptionByQuestion.clear();
        skillNameByQuestion.clear();

        Skill java = skill("RndJava");
        Skill sql = skill("RndSql");
        Skill git = skill("RndGit");

        careerA = career("Rnd Career A");
        framework(careerA, java, 50);
        framework(careerA, sql, 30);
        framework(careerA, git, 20);
        assessmentA = assessment(careerA, "Rnd Assessment A");
        // 30-question bank, 10 per skill, difficulties cycling.
        bank(assessmentA, "A", List.of(java, sql, git), 30);

        careerB = career("Rnd Career B");
        framework(careerB, sql, 100);
        assessmentB = assessment(careerB, "Rnd Assessment B");
        bank(assessmentB, "B", List.of(sql), 4);
    }

    @Test
    @DisplayName("Large bank is sampled to a bounded, de-duplicated subset covering every framework skill")
    void largeBank_sampledWithSkillCoverage() throws Exception {
        String student = register("rnd1@test.local");
        selectCareer(student, careerA.getId());

        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentA.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalQuestions").value(AssessmentService.MAX_ATTEMPT_QUESTIONS))
                .andExpect(jsonPath("$.data.questions.length()").value(AssessmentService.MAX_ATTEMPT_QUESTIONS))
                .andReturn();
        JsonNode data = body(start).path("data");

        List<Long> ids = questionIds(data);
        assertEquals(new HashSet<>(ids).size(), ids.size(), "no duplicate questions within one attempt");

        Map<String, Long> bySkill = ids.stream()
                .collect(Collectors.groupingBy(skillNameByQuestion::get, Collectors.counting()));
        assertEquals(Set.of("RndJava", "RndSql", "RndGit"), bySkill.keySet(),
                "every framework skill must be represented");
        assertTrue(bySkill.get("RndJava") >= bySkill.get("RndSql")
                        && bySkill.get("RndSql") >= bySkill.get("RndGit"),
                "quotas must follow framework weights 50/30/20, was " + bySkill);

        Set<String> difficulties = new HashSet<>();
        data.path("questions").forEach(q -> difficulties.add(q.path("difficulty").asText()));
        assertTrue(difficulties.size() >= 2, "difficulties must be mixed, was " + difficulties);

        // Student overview reports the per-attempt size, not the whole bank.
        mockMvc.perform(get("/api/v1/assessments/" + careerA.getId() + "/available")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].questionCount").value(AssessmentService.MAX_ATTEMPT_QUESTIONS));
    }

    @Test
    @DisplayName("Retake produces a different set, preferring previously unseen questions")
    void retake_prefersUnseenQuestions() throws Exception {
        String student = register("rnd2@test.local");
        selectCareer(student, careerA.getId());

        long first = startAttempt(student, assessmentA.getId());
        Set<Long> firstSet = questionIdSet(getState(student, first));
        assertEquals(AssessmentService.MAX_ATTEMPT_QUESTIONS, firstSet.size());

        answerAll(student, first, firstSet);
        submit(student, first);

        long second = startAttempt(student, assessmentA.getId());
        Set<Long> secondSet = questionIdSet(getState(student, second));
        assertEquals(AssessmentService.MAX_ATTEMPT_QUESTIONS, secondSet.size());
        assertNotEquals(firstSet, secondSet, "retake must receive a different question set");

        Set<Long> unseenAfterFirst = bankQuestionIds(assessmentA.getId()).stream()
                .filter(id -> !firstSet.contains(id))
                .collect(Collectors.toSet());
        assertEquals(10, unseenAfterFirst.size(), "30 bank - 20 served = 10 unseen");
        assertTrue(secondSet.containsAll(unseenAfterFirst),
                "second attempt must first consume the remaining unseen questions");
    }

    @Test
    @DisplayName("When unseen questions run out, seen questions refill the attempt instead of failing")
    void unseenExhausted_seenQuestionsRefill() throws Exception {
        // Shrink bank B to 22: 20 + 2. First attempt serves 20, second serves
        // the 2 unseen plus 18 previously seen.
        bank(assessmentB, "B2", List.of(skillRepository.findAll().stream()
                .filter(s -> s.getName().equals("RndSql")).findFirst().orElseThrow()), 18);
        assertEquals(22, bankQuestionIds(assessmentB.getId()).size());

        String student = register("rnd3@test.local");
        selectCareer(student, careerB.getId());

        long first = startAttempt(student, assessmentB.getId());
        Set<Long> firstSet = questionIdSet(getState(student, first));
        assertEquals(20, firstSet.size());
        answerAll(student, first, firstSet);
        submit(student, first);

        long second = startAttempt(student, assessmentB.getId());
        Set<Long> secondSet = questionIdSet(getState(student, second));
        assertEquals(20, secondSet.size());
        Set<Long> unseenAfterFirst = bankQuestionIds(assessmentB.getId()).stream()
                .filter(id -> !firstSet.contains(id))
                .collect(Collectors.toSet());
        assertEquals(2, unseenAfterFirst.size());
        assertTrue(secondSet.containsAll(unseenAfterFirst),
                "remaining unseen questions must be included first");
    }

    @Test
    @DisplayName("Small banks are still served in full, keeping legacy attempts valid")
    void smallBank_servedInFull() throws Exception {
        String student = register("rnd4@test.local");
        selectCareer(student, careerB.getId());

        // Career B bank has 4 questions (< MAX): all must be served.
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentB.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalQuestions").value(4))
                .andExpect(jsonPath("$.data.questions.length()").value(4))
                .andReturn();
        long attemptId = body(start).path("data").path("attemptId").asLong();
        Set<Long> firstOrder = questionIdSet(body(start).path("data"));

        // Resume and refresh keep the frozen per-attempt set and order.
        MvcResult resumed = mockMvc.perform(post("/api/v1/assessments/" + assessmentB.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(firstOrder, questionIdSet(body(resumed).path("data")),
                "resume must keep the attempt's frozen set");
        MvcResult state = mockMvc.perform(get("/api/v1/assessments/attempts/" + attemptId)
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(firstOrder, questionIdSet(body(state).path("data")),
                "refresh must keep the attempt's frozen set");
    }

    @Test
    @DisplayName("Correct answers are never exposed before submission")
    void correctAnswersStayServerSide() throws Exception {
        String student = register("rnd5@test.local");
        selectCareer(student, careerA.getId());

        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentA.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andReturn();
        String payload = start.getResponse().getContentAsString();
        assertTrue(!payload.contains("\"correct\""), "start response must not leak correctness");
        long attemptId = body(start).path("data").path("attemptId").asLong();

        MvcResult state = mockMvc.perform(get("/api/v1/assessments/attempts/" + attemptId)
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andReturn();
        assertTrue(!state.getResponse().getContentAsString().contains("\"correct\""),
                "state response must not leak correctness");
    }

    @Test
    @DisplayName("Answers outside the attempt set are rejected; scoring grades the attempt subset")
    void foreignQuestionRejected_scoringUsesSubset() throws Exception {
        String student = register("rnd6@test.local");
        selectCareer(student, careerA.getId());

        long attemptId = startAttempt(student, assessmentA.getId());
        Set<Long> attemptSet = questionIdSet(getState(student, attemptId));

        Long foreignQuestion = bankQuestionIds(assessmentA.getId()).stream()
                .filter(id -> !attemptSet.contains(id))
                .findFirst().orElseThrow();
        Long foreignOption = optionRepository.findByQuestionIdOrderByDisplayOrderAsc(foreignQuestion)
                .get(0).getId();
        mockMvc.perform(put("/api/v1/assessments/attempts/" + attemptId + "/answers")
                        .header("Authorization", "Bearer " + student)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionId\": %d, \"optionId\": %d}"
                                .formatted(foreignQuestion, foreignOption)))
                .andExpect(status().isBadRequest());

        // All-correct on the subset: overall 100, per-skill counts sum to the
        // attempt size (not the 30-question bank).
        answerAll(student, attemptId, attemptSet);
        MvcResult submitted = mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallScore").value(100))
                .andExpect(jsonPath("$.data.skills.length()").value(3))
                .andReturn();
        int totalCounted = 0;
        for (JsonNode skill : body(submitted).path("data").path("skills")) {
            totalCounted += skill.path("questionCount").asInt();
            assertEquals(100, skill.path("scorePercent").asInt());
        }
        assertEquals(AssessmentService.MAX_ATTEMPT_QUESTIONS, totalCounted);

        // Readiness and gap analysis follow the same submitted subset.
        mockMvc.perform(get("/api/v1/students/me/readiness")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetCareerId").value(careerA.getId()))
                .andExpect(jsonPath("$.data.assessedSkills").value(3))
                .andExpect(jsonPath("$.data.readinessPercent").value(100));
    }

    @Test
    @DisplayName("Switching careers switches the question pool; cross-career starts stay forbidden")
    void careerSwitch_switchesPool() throws Exception {
        String student = register("rnd7@test.local");
        selectCareer(student, careerA.getId());

        MvcResult startA = mockMvc.perform(post("/api/v1/assessments/" + assessmentA.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andReturn();
        Set<Long> setA = questionIdSet(body(startA).path("data"));
        Set<Long> bankA = bankQuestionIds(assessmentA.getId());
        assertTrue(bankA.containsAll(setA), "attempt A must only contain career A questions");

        mockMvc.perform(post("/api/v1/assessments/" + assessmentB.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isForbidden());

        selectCareer(student, careerB.getId());
        MvcResult startB = mockMvc.perform(post("/api/v1/assessments/" + assessmentB.getId() + "/start")
                        .header("Authorization", "Bearer " + student))
                .andExpect(status().isOk())
                .andReturn();
        Set<Long> setB = questionIdSet(body(startB).path("data"));
        assertTrue(bankQuestionIds(assessmentB.getId()).containsAll(setB),
                "attempt B must only contain career B questions");
        assertTrue(setB.stream().noneMatch(setA::contains), "no stale career A questions after switch");
    }

    // ---------- helpers ----------

    private Skill skill(String name) {
        return skillRepository.save(Skill.builder()
                .name(name).category(SkillCategory.PROGRAMMING_LANGUAGES)
                .description(name).active(true).build());
    }

    private Career career(String name) {
        return careerRepository.save(Career.builder()
                .name(name).description(name)
                .category(CareerCategory.SOFTWARE_DEVELOPMENT)
                .difficultyLevel(DifficultyLevel.INTERMEDIATE)
                .published(true).build());
    }

    private void framework(Career career, Skill skill, int weight) {
        careerSkillRepository.save(CareerSkill.builder()
                .career(career).skill(skill)
                .weightPercent(weight).requiredLevel(SkillLevel.INTERMEDIATE).targetPercent(80).build());
    }

    private AssessmentTest assessment(Career career, String title) {
        return assessmentTestRepository.save(AssessmentTest.builder()
                .career(career).title(title).description(title)
                .durationMinutes(30).published(true).build());
    }

    private void bank(AssessmentTest assessment, String tag, List<Skill> skills, int count) {
        DifficultyLevel[] levels = DifficultyLevel.values();
        int order = questionRepository.findByAssessmentIdOrderByDisplayOrderAsc(assessment.getId())
                .stream().mapToInt(AssessmentQuestion::getDisplayOrder).max().orElse(0);
        for (int i = 0; i < count; i++) {
            Skill skill = skills.get(i % skills.size());
            order++;
            AssessmentQuestion question = questionRepository.save(AssessmentQuestion.builder()
                    .assessment(assessment).skill(skill)
                    .questionText("Rnd " + tag + " Q" + order + " (" + skill.getName() + ")")
                    .questionType(QuestionType.MCQ)
                    .difficulty(levels[i % levels.length])
                    .explanation("explanation")
                    .displayOrder(order).active(true).build());
            long correct = optionRepository.save(QuestionOption.builder()
                    .question(question).optionText("Right " + order)
                    .correct(true).displayOrder(1).build()).getId();
            optionRepository.save(QuestionOption.builder()
                    .question(question).optionText("Wrong " + order)
                    .correct(false).displayOrder(2).build());
            correctOptionByQuestion.put(question.getId(), correct);
            skillNameByQuestion.put(question.getId(), skill.getName());
        }
    }

    private Set<Long> bankQuestionIds(Long assessmentId) {
        return questionRepository.findByAssessmentIdAndActiveTrueOrderByDisplayOrderAsc(assessmentId)
                .stream().map(AssessmentQuestion::getId).collect(Collectors.toSet());
    }

    private String register(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Random Student",
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
                .andExpect(status().isOk());
    }

    private long startAttempt(String token, long assessmentId) throws Exception {
        MvcResult start = mockMvc.perform(post("/api/v1/assessments/" + assessmentId + "/start")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return body(start).path("data").path("attemptId").asLong();
    }

    private JsonNode getState(String token, long attemptId) throws Exception {
        MvcResult state = mockMvc.perform(get("/api/v1/assessments/attempts/" + attemptId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return body(state).path("data");
    }

    private void answerAll(String token, long attemptId, Set<Long> questionIds) throws Exception {
        for (Long questionId : questionIds) {
            mockMvc.perform(put("/api/v1/assessments/attempts/" + attemptId + "/answers")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"questionId\": %d, \"optionId\": %d}"
                                    .formatted(questionId, correctOptionByQuestion.get(questionId))))
                    .andExpect(status().isOk());
        }
    }

    private void submit(String token, long attemptId) throws Exception {
        mockMvc.perform(post("/api/v1/assessments/attempts/" + attemptId + "/submit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    private JsonNode body(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsString());
    }

    private List<Long> questionIds(JsonNode data) {
        List<Long> ids = new ArrayList<>();
        for (JsonNode q : data.path("questions")) {
            ids.add(q.path("questionId").asLong());
        }
        return ids;
    }

    private Set<Long> questionIdSet(JsonNode data) {
        return new HashSet<>(questionIds(data));
    }
}

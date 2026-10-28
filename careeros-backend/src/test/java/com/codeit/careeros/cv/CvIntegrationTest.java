package com.codeit.careeros.cv;

import com.codeit.careeros.TestDataCleaner;
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
import com.codeit.careeros.repository.ProjectProgressRepository;
import com.codeit.careeros.repository.ProjectRepository;
import com.codeit.careeros.repository.ProjectSkillRepository;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CvIntegrationTest {

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
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectSkillRepository projectSkillRepository;

    @Autowired
    private ProjectProgressRepository projectProgressRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    private Long careerId;
    private Long assessmentId;
    private Long questionJava1;
    private Long optionJava1;

    @Autowired
    private TestDataCleaner testDataCleaner;

    @BeforeEach
    void setUp() throws Exception {
        testDataCleaner.clean();
        cvDocumentRepository.deleteAll();
        cleanStorageDir();
        skillScoreRepository.deleteAll();
        answerRepository.deleteAll();
        attemptRepository.deleteAll();
        optionRepository.deleteAll();
        questionRepository.deleteAll();
        assessmentTestRepository.deleteAll();
        careerSkillRepository.deleteAll();
        projectProgressRepository.deleteAll();
        projectSkillRepository.deleteAll();
        projectRepository.deleteAll();
        studentProfileRepository.deleteAll();
        careerRepository.deleteAll();
        skillRepository.deleteAll();

        Skill java = skillRepository.save(Skill.builder()
                .name("CV Java").category(SkillCategory.PROGRAMMING_LANGUAGES)
                .description("Java").active(true).build());
        Skill spring = skillRepository.save(Skill.builder()
                .name("CV Spring Boot").category(SkillCategory.FRAMEWORKS)
                .description("Spring").active(true).build());
        Skill docker = skillRepository.save(Skill.builder()
                .name("CV Docker").category(SkillCategory.CLOUD)
                .description("Docker").active(true).build());

        Career career = careerRepository.save(Career.builder()
                .name("CV Career").description("Test")
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
                .career(career).title("CV Assessment").description("Test")
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
    @DisplayName("Upload PDF parses contact data and analysis detects skills without a target career")
    void uploadPdf_parsesAndAnalyzes() throws Exception {
        String token = registerStudent("cv-pdf@test.local");
        byte[] pdf = minimalPdf();

        mockMvc.perform(multipart("/api/v1/cvs")
                        .file(new MockMultipartFile("file", "john-cv.pdf", "application/pdf", pdf)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(multipart("/api/v1/cvs")
                        .file(new MockMultipartFile("file", "john-cv.pdf", "application/pdf", pdf))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PARSED"))
                .andExpect(jsonPath("$.data.originalFilename").value("john-cv.pdf"))
                .andExpect(jsonPath("$.data.candidateName").value("John Doe"))
                .andExpect(jsonPath("$.data.candidateEmail").value("john.doe@example.com"));

        mockMvc.perform(get("/api/v1/cvs/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.candidatePhone").value("+91 98765 43210"));

        mockMvc.perform(get("/api/v1/cvs/analysis")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasCv").value(true))
                .andExpect(jsonPath("$.data.hasTarget").value(false))
                .andExpect(jsonPath("$.data.detectedSkills[?(@.skillName == 'CV Java')]").exists())
                .andExpect(jsonPath("$.data.detectedSkills[?(@.skillName == 'CV Spring Boot')]").exists())
                .andExpect(jsonPath("$.data.matchedSkills.length()").value(0))
                .andExpect(jsonPath("$.data.completeness.scorePercent").value(100))
                .andExpect(jsonPath("$.data.completeness.suggestions.length()").value(0))
                .andExpect(jsonPath("$.data.sections.length()").value(8))
                .andExpect(jsonPath("$.data.sections[*].passed", everyItem(is(true))))
                .andExpect(jsonPath("$.data.atsScore").value(100))
                .andExpect(jsonPath("$.data.overallScore").value(100));
    }

    @Test
    @DisplayName("Analysis with a target career splits framework skills into matched and missing")
    void analysis_withTargetCareer_matchesAndMisses() throws Exception {
        String token = registerStudent("cv-gaps@test.local");
        setTargetCareer(token);
        submitAssessment(token);

        mockMvc.perform(multipart("/api/v1/cvs")
                        .file(new MockMultipartFile("file", "cv.pdf", "application/pdf", minimalPdf()))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // CV mentions Java (assessed 100 vs target 80) but not Docker.
        mockMvc.perform(get("/api/v1/cvs/analysis")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasTarget").value(true))
                .andExpect(jsonPath("$.data.matchedSkills.length()").value(1))
                .andExpect(jsonPath("$.data.matchedSkills[0].skillName").value("CV Java"))
                .andExpect(jsonPath("$.data.matchedSkills[0].scorePercent").value(100))
                .andExpect(jsonPath("$.data.matchedSkills[0].gapPercent").value(20))
                .andExpect(jsonPath("$.data.missingSkills.length()").value(1))
                .andExpect(jsonPath("$.data.missingSkills[0].skillName").value("CV Docker"))
                .andExpect(jsonPath("$.data.sections.length()").value(8))
                .andExpect(jsonPath("$.data.atsScore").value(100))
                .andExpect(jsonPath("$.data.overallScore").value(85));
    }

    @Test
    @DisplayName("Replacing a CV swaps the file and keeps a single document per student")
    void replaceCv_swapsFileAndKeepsSingleDocument() throws Exception {
        String token = registerStudent("cv-replace@test.local");

        MvcResult first = mockMvc.perform(multipart("/api/v1/cvs")
                        .file(new MockMultipartFile("file", "first.pdf", "application/pdf", minimalPdf()))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PARSED"))
                .andReturn();
        long firstId = mapper.readTree(first.getResponse().getContentAsString())
                .path("data").path("documentId").asLong();

        mockMvc.perform(multipart("/api/v1/cvs")
                        .file(new MockMultipartFile("file", "second.docx",
                                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                minimalDocx()))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentId").value((int) firstId))
                .andExpect(jsonPath("$.data.originalFilename").value("second.docx"))
                .andExpect(jsonPath("$.data.status").value("PARSED"))
                .andExpect(jsonPath("$.data.candidateName").value("Jane Smith"));

        // Old object deleted: exactly one file remains in the local store.
        try (var files = Files.list(storageDir()) .filter(Files::isRegularFile)) {
            assert files.count() == 1 : "replaced CV object must be deleted from storage";
        }

        // Download returns the replacement bytes (fetched from storage, not regenerated).
        MvcResult stored = mockMvc.perform(get("/api/v1/cvs/download")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("second.docx")))
                .andReturn();
        assert stored.getResponse().getContentAsByteArray().length > 500
                : "download must return the replacement file";
    }

    @Test
    @DisplayName("Invalid files are rejected and ownership is enforced")
    void invalidFiles_rejectedAndOwnership_enforced() throws Exception {
        String owner = registerStudent("cv-owner@test.local");
        String other = registerStudent("cv-other@test.local");

        mockMvc.perform(multipart("/api/v1/cvs")
                        .file(new MockMultipartFile("file", "notes.txt", "text/plain", "hello".getBytes()))
                        .header("Authorization", "Bearer " + owner))
                .andExpect(status().isBadRequest());

        mockMvc.perform(multipart("/api/v1/cvs")
                        .file(new MockMultipartFile("file", "big.pdf", "application/pdf", new byte[6 * 1024 * 1024]))
                        .header("Authorization", "Bearer " + owner))
                .andExpect(status().isBadRequest());

        mockMvc.perform(multipart("/api/v1/cvs")
                        .file(new MockMultipartFile("file", "john-cv.pdf", "application/pdf", minimalPdf()))
                        .header("Authorization", "Bearer " + owner))
                .andExpect(status().isOk());

        // Other student sees nothing of the owner's CV.
        mockMvc.perform(get("/api/v1/cvs/me")
                        .header("Authorization", "Bearer " + other))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist());
        mockMvc.perform(get("/api/v1/cvs/analysis")
                        .header("Authorization", "Bearer " + other))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasCv").value(false));
        mockMvc.perform(get("/api/v1/cvs/download")
                        .header("Authorization", "Bearer " + other))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/cvs/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/cvs/analysis")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/cvs/download")).andExpect(status().isUnauthorized());
    }

    private String registerStudent(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "CV Student",
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

    /** Hand-built single-page PDF (no xref; PDFBox/Tika rebuild it). */
    static byte[] minimalPdf() {
        String content = "BT /F1 12 Tf 50 750 Td 16 TL "
                + "(John Doe) Tj T* "
                + "(john.doe@example.com) Tj T* "
                + "(+91 98765 43210) Tj T* "
                + "(Summary) Tj T* "
                + "(Motivated Java developer with hands-on internship experience) Tj T* "
                + "(building REST APIs, SQL databases and Spring Boot services) Tj T* "
                + "(Achievements) Tj T* "
                + "(Winner of the college hackathon for the best database design project) Tj T* "
                + "(Education) Tj T* "
                + "(B.Tech Computer Science, ABC College 2024) Tj T* "
                + "(Skills) Tj T* "
                + "(Java, CV Spring Boot, SQL, Git) Tj T* "
                + "(Experience) Tj T* "
                + "(Intern at XYZ, built REST APIs with Java) Tj T* "
                + "(Projects) Tj T* "
                + "(Online bookstore with SQL database) Tj T* "
                + "(Built with a React frontend and MySQL backend for the final year project) Tj T* "
                + "(Certifications) Tj T* "
                + "(Cloud Practitioner course) Tj ET";
        byte[] contentBytes = content.getBytes(StandardCharsets.US_ASCII);
        String pdf = "%PDF-1.4\n"
                + "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
                + "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
                + "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                + "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
                + "4 0 obj\n<< /Length " + contentBytes.length + " >>\nstream\n"
                + content + "\nendstream\nendobj\n"
                + "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
                + "trailer\n<< /Root 1 0 R >>\n";
        return pdf.getBytes(StandardCharsets.US_ASCII);
    }

    /** Hand-built minimal DOCX (just enough OOXML for Tika). */
    static byte[] minimalDocx() throws Exception {
        String types = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
                + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
                + "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
                + "<Override PartName=\"/word/document.xml\" "
                + "ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
                + "</Types>";
        String rels = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                + "<Relationship Id=\"rId1\" "
                + "Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" "
                + "Target=\"word/document.xml\"/></Relationships>";
        String doc = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                + "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
                + "<w:body>"
                + "<w:p><w:r><w:t>Jane Smith</w:t></w:r></w:p>"
                + "<w:p><w:r><w:t>Skills: Python, SQL. Experience: data analyst intern.</w:t></w:r></w:p>"
                + "</w:body></w:document>";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            addEntry(zip, "[Content_Types].xml", types);
            addEntry(zip, "_rels/.rels", rels);
            addEntry(zip, "word/document.xml", doc);
        }
        return out.toByteArray();
    }

    private static void addEntry(ZipOutputStream zip, String name, String content) throws Exception {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static Path storageDir() {
        return Paths.get(System.getProperty("java.io.tmpdir"), "careeros-cv-test");
    }

    private static void cleanStorageDir() throws Exception {
        Path dir = storageDir();
        if (!Files.exists(dir)) {
            return;
        }
        try (var walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder())
                    .filter(path -> !path.equals(dir))
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (Exception ignored) {
                        }
                    });
        }
    }
}

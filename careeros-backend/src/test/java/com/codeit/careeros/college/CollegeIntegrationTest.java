package com.codeit.careeros.college;

import com.codeit.careeros.college.entity.AcademicYear;
import com.codeit.careeros.college.entity.Batch;
import com.codeit.careeros.college.entity.Department;
import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.college.entity.Program;
import com.codeit.careeros.college.entity.Section;
import com.codeit.careeros.college.entity.StaffInvitation;
import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.college.enums.InstitutionStatus;
import com.codeit.careeros.college.enums.ScopeType;
import com.codeit.careeros.college.enums.StaffDesignation;
import com.codeit.careeros.college.repository.AcademicYearRepository;
import com.codeit.careeros.college.repository.BatchRepository;
import com.codeit.careeros.college.repository.DepartmentRepository;
import com.codeit.careeros.college.repository.InstitutionRepository;
import com.codeit.careeros.college.repository.InstitutionMembershipRepository;
import com.codeit.careeros.college.repository.ProgramRepository;
import com.codeit.careeros.college.repository.SectionRepository;
import com.codeit.careeros.college.repository.StaffInvitationRepository;
import com.codeit.careeros.college.repository.StudentEnrollmentRepository;
import com.codeit.careeros.college.service.StudentCsvService;
import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.common.enums.UserStatus;
import com.codeit.careeros.entity.AuditEvent;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.repository.AuditEventRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.security.TokenHash;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end college Phase 1 isolation, invitation, CSV and audit tests.
 *
 * <p>These run against the same H2 test database as the rest of the suite, so
 * every fixture uses a unique institution code, email and roll number.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CollegeIntegrationTest {

    private static final String ADMIN_EMAIL = "admin@test.local";
    private static final String ADMIN_PASSWORD = "Admin@123Test";
    private static final String PASSWORD = "Password1";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private InstitutionRepository institutionRepository;
    @Autowired private InstitutionMembershipRepository membershipRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private ProgramRepository programRepository;
    @Autowired private AcademicYearRepository academicYearRepository;
    @Autowired private BatchRepository batchRepository;
    @Autowired private SectionRepository sectionRepository;
    @Autowired private StudentEnrollmentRepository enrollmentRepository;
    @Autowired private StudentProfileRepository studentProfileRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StaffInvitationRepository invitationRepository;
    @Autowired private AuditEventRepository auditEventRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    /**
     * College enrollments are owned by student profiles that older test
     * suites delete in their own setup. Remove them before the next class so
     * shared-context cleanup never violates the enrollment foreign key.
     */
    @AfterEach
    void cleanCollegeEnrollments() {
        enrollmentRepository.deleteAll();
        invitationRepository.deleteAll();
        membershipRepository.deleteAll();
    }

    // ------------------------------------------------------------------
    // Invitations
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Invitation is single-use, masks the email and is audited")
    void invitation_singleUse_masksEmail_audited() throws Exception {
        Institution institution = institution("INV" + suffix());
        String collegeAdmin = bootstrapAdmin(institution, "admin-" + suffix() + "@college.test");

        String invitee = "tpo-" + suffix() + "@college.test";
        JsonNode created = createInvitation(collegeAdmin, "TPO", "INSTITUTION", null, invitee);
        String token = tokenFromPath(created.path("data").path("activationPath").asText());
        assertThat(created.path("data").path("emailDelivered").asBoolean()).isFalse();

        JsonNode publicMeta = getJson("/api/v1/invitations/" + token, null);
        assertThat(publicMeta.path("data").path("maskedEmail").asText()).contains("***");
        assertThat(publicMeta.path("data").path("status").asText()).isEqualTo("VALID");

        JsonNode accepted = accept(token, "TPO Person", PASSWORD);
        assertThat(accepted.path("data").path("accessToken").asText()).isNotBlank();
        assertThat(accepted.path("data").path("user").path("role").asText()).isEqualTo("PROFESSOR");

        // Reuse is rejected.
        mockMvc.perform(post("/api/v1/invitations/" + token + "/accept")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(acceptBody("TPO Person", PASSWORD)))
                .andExpect(status().isConflict());

        List<AuditEvent> events = auditEventRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(e -> institution.getId().equals(e.getInstitutionId()))
                .toList();
        assertThat(events).anyMatch(e -> "STAFF_INVITATION_CREATE".equals(e.getAction()));
        assertThat(events).anyMatch(e -> "STAFF_INVITATION_ACCEPT".equals(e.getAction()));
    }

    @Test
    @DisplayName("Expired invitation metadata is public but acceptance is rejected")
    void invitation_expired_rejected() throws Exception {
        Institution institution = institution("EXP" + suffix());
        User creator = user("creator-" + suffix() + "@college.test", Role.PROFESSOR);
        String raw = "expired-" + UUID.randomUUID();
        StaffInvitation invitation = StaffInvitation.builder()
                .institution(institution)
                .email("expired-" + suffix() + "@college.test")
                .designation(StaffDesignation.FACULTY)
                .scopeType(ScopeType.DEPARTMENT)
                .scopeId(department(institution, "D" + suffix()).getId())
                .tokenHash(TokenHash.sha256(raw))
                .expiresAt(Instant.now().minus(1, ChronoUnit.HOURS))
                .createdBy(creator)
                .build();
        invitationRepository.saveAndFlush(invitation);

        JsonNode meta = getJson("/api/v1/invitations/" + raw, null);
        assertThat(meta.path("data").path("status").asText()).isEqualTo("EXPIRED");

        mockMvc.perform(post("/api/v1/invitations/" + raw + "/accept")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(acceptBody("Expired Person", PASSWORD)))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------
    // Tenant and academic scope isolation
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Two institutions are isolated and department scope cannot widen via forged ids")
    void crossTenant_andDepartmentScope_areEnforced() throws Exception {
        Institution a = institution("A" + suffix());
        String adminA = bootstrapAdmin(a, "a-admin-" + suffix() + "@college.test");
        Department a1 = department(a, "A1" + suffix());
        Department a2 = department(a, "A2" + suffix());
        AcademicYear yearA = academicYear(a, "2026-" + suffix());
        Program p1 = program(a, a1, "P1" + suffix());
        Program p2 = program(a, a2, "P2" + suffix());
        Batch b1 = batch(p1, yearA, "B1" + suffix());
        Batch b2 = batch(p2, yearA, "B2" + suffix());
        Section s1 = section(b1, "S1" + suffix());
        Section s2 = section(b2, "S2" + suffix());
        StudentEnrollment studentA1 = student(a, a1, p1, b1, s1, "RA1" + suffix(), "sa1-" + suffix() + "@student.test");
        StudentEnrollment studentA2 = student(a, a2, p2, b2, s2, "RA2" + suffix(), "sa2-" + suffix() + "@student.test");

        Institution b = institution("B" + suffix());
        String adminB = bootstrapAdmin(b, "b-admin-" + suffix() + "@college.test");
        Department b1d = department(b, "B1" + suffix());
        AcademicYear yearB = academicYear(b, "2026-" + suffix());
        Program pB = program(b, b1d, "PB" + suffix());
        Batch bB = batch(pB, yearB, "BB" + suffix());
        Section sB = section(bB, "SB" + suffix());
        StudentEnrollment studentB = student(b, b1d, pB, bB, sB, "RB1" + suffix(), "sb1-" + suffix() + "@student.test");

        // Full-institution admin sees both own students and none from B.
        JsonNode listA = getJson("/api/v1/college/students", adminA);
        assertThat(listA.path("data").path("totalElements").asInt()).isEqualTo(2);
        assertThat(listA.path("data").path("items").toString())
                .contains(studentA1.getRollNumber())
                .doesNotContain(studentB.getRollNumber());

        mockMvc.perform(get("/api/v1/college/students/" + studentB.getId())
                        .header("Authorization", "Bearer " + adminA))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/college/students/" + studentB.getId() + "/report.pdf")
                        .header("Authorization", "Bearer " + adminA))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/college/dashboard")
                        .header("Authorization", "Bearer " + adminB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalEnrolled").value(1));

        // Department-scoped HOD only sees A1.
        String hodEmail = "hod-" + suffix() + "@college.test";
        JsonNode hodInvite = createInvitation(adminA, "HOD", "DEPARTMENT", a1.getId(), hodEmail);
        String hod = accept(tokenFromPath(hodInvite.path("data").path("activationPath").asText()),
                "HOD Person", PASSWORD).path("data").path("accessToken").asText();

        JsonNode hodList = getJson("/api/v1/college/students", hod);
        assertThat(hodList.path("data").path("totalElements").asInt()).isEqualTo(1);
        assertThat(hodList.path("data").path("items").toString()).contains(studentA1.getRollNumber());

        mockMvc.perform(get("/api/v1/college/students/" + studentA1.getId())
                        .header("Authorization", "Bearer " + hod))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profile.email").doesNotExist())
                .andExpect(jsonPath("$.data.profile.mobile").doesNotExist())
                .andExpect(jsonPath("$.data.profile.dateOfBirth").doesNotExist())
                .andExpect(jsonPath("$.data.profile.linkedinUrl").doesNotExist())
                .andExpect(jsonPath("$.data.cvAnalysis").doesNotExist())
                .andExpect(jsonPath("$.data.linkedInAnalysis").doesNotExist());
        mockMvc.perform(get("/api/v1/college/students/" + studentA2.getId())
                        .header("Authorization", "Bearer " + hod))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/college/students/" + studentB.getId())
                        .header("Authorization", "Bearer " + hod))
                .andExpect(status().isNotFound());

        // Asking for a department outside the membership is a 404, not a wider list.
        mockMvc.perform(get("/api/v1/college/students")
                        .param("departmentId", String.valueOf(a2.getId()))
                        .header("Authorization", "Bearer " + hod))
                .andExpect(status().isNotFound());

        // Faculty gets read access without sensitive fields, and cannot export/report/mutate.
        String facultyEmail = "faculty-" + suffix() + "@college.test";
        JsonNode facultyInvite = createInvitation(adminA, "FACULTY", "DEPARTMENT", a1.getId(), facultyEmail);
        String faculty = accept(tokenFromPath(facultyInvite.path("data").path("activationPath").asText()),
                "Faculty Person", PASSWORD).path("data").path("accessToken").asText();

        mockMvc.perform(get("/api/v1/college/students/" + studentA1.getId())
                        .header("Authorization", "Bearer " + faculty))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.profile.email").doesNotExist())
                .andExpect(jsonPath("$.data.cvAnalysis").doesNotExist());
        mockMvc.perform(get("/api/v1/college/students/export.csv")
                        .header("Authorization", "Bearer " + faculty))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/college/reports/cohort.pdf")
                        .header("Authorization", "Bearer " + faculty))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/v1/college/students/" + studentA1.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"INACTIVE\",\"reason\":\"test\"}")
                        .header("Authorization", "Bearer " + faculty))
                .andExpect(status().isForbidden());

        // A student token can never reach college endpoints.
        String studentToken = login(studentA1.getStudentProfile().getUser().getEmail(), PASSWORD);
        mockMvc.perform(get("/api/v1/college/students")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());

        // Platform admin has no implicit college PII access.
        mockMvc.perform(get("/api/v1/college/students")
                        .header("Authorization", "Bearer " + login(ADMIN_EMAIL, ADMIN_PASSWORD)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Scoped search, dashboard and PDF reports succeed and are audited")
    void scopedSearchDashboardAndReports() throws Exception {
        Institution institution = institution("RPT" + suffix());
        String admin = bootstrapAdmin(institution, "rpt-admin-" + suffix() + "@college.test");
        Department department = department(institution, "RD" + suffix());
        AcademicYear year = academicYear(institution, "RY" + suffix());
        Program program = program(institution, department, "RP" + suffix());
        Batch batch = batch(program, year, "RB" + suffix());
        Section section = section(batch, "RS" + suffix());
        StudentEnrollment first = student(institution, department, program, batch, section,
                "R1" + suffix(), "r1-" + suffix() + "@student.test");
        StudentEnrollment second = student(institution, department, program, batch, section,
                "R2" + suffix(), "r2-" + suffix() + "@student.test");

        JsonNode search = getJson("/api/v1/college/students?search=" + first.getRollNumber(), admin);
        assertThat(search.path("data").path("totalElements").asInt()).isEqualTo(1);
        assertThat(search.path("data").path("items").get(0).path("rollNumber").asText())
                .isEqualTo(first.getRollNumber());

        JsonNode filtered = getJson("/api/v1/college/students?departmentId=" + department.getId(), admin);
        assertThat(filtered.path("data").path("totalElements").asInt()).isEqualTo(2);

        JsonNode dashboard = getJson("/api/v1/college/dashboard", admin);
        assertThat(dashboard.path("data").path("totalEnrolled").asInt()).isEqualTo(2);
        assertThat(dashboard.path("data").path("activeStudents").asInt()).isEqualTo(2);
        assertThat(dashboard.path("data").path("assessmentParticipants").asInt()).isZero();
        assertThat(dashboard.path("data").path("studentsNotAssessed").asInt()).isEqualTo(2);
        assertThat(dashboard.path("data").path("assessmentCompletionPercent").asInt()).isZero();
        assertThat(dashboard.path("data").path("definitions").isArray()).isTrue();

        JsonNode notAssessed = getJson("/api/v1/college/students?assessmentCompleted=false", admin);
        assertThat(notAssessed.path("data").path("totalElements").asInt()).isEqualTo(2);
        JsonNode assessed = getJson("/api/v1/college/students?assessmentCompleted=true", admin);
        assertThat(assessed.path("data").path("totalElements").asInt()).isZero();
        JsonNode noReadiness = getJson("/api/v1/college/students?readinessEvaluated=false", admin);
        assertThat(noReadiness.path("data").path("totalElements").asInt()).isEqualTo(2);

        MvcResult cohort = mockMvc.perform(get("/api/v1/college/reports/cohort.pdf")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(cohort.getResponse().getContentType()).startsWith("application/pdf");
        assertThat(new String(cohort.getResponse().getContentAsByteArray(), 0, 4, StandardCharsets.US_ASCII))
                .isEqualTo("%PDF");

        MvcResult studentPdf = mockMvc.perform(get("/api/v1/college/students/" + first.getId() + "/report.pdf")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(studentPdf.getResponse().getContentType()).startsWith("application/pdf");
        assertThat(new String(studentPdf.getResponse().getContentAsByteArray(), 0, 4, StandardCharsets.US_ASCII))
                .isEqualTo("%PDF");

        List<AuditEvent> events = auditEventRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(event -> institution.getId().equals(event.getInstitutionId()))
                .toList();
        assertThat(events).anyMatch(event -> "REPORT_COHORT_PDF".equals(event.getAction()));
        assertThat(events).anyMatch(event -> "REPORT_STUDENT_PDF".equals(event.getAction()));
        assertThat(second.getId()).isNotNull();
    }

    @Test
    @DisplayName("Phase 1 CSV reports are scoped and omit unapproved contact fields")
    void phaseOneCsvReports_areScopedAndUseFieldAllowlist() throws Exception {
        Institution institution = institution("CSVREP" + suffix());
        String admin = bootstrapAdmin(institution, "csv-report-" + suffix() + "@college.test");
        Department department = department(institution, "CRD" + suffix());
        AcademicYear year = academicYear(institution, "CRY" + suffix());
        Program program = program(institution, department, "CRP" + suffix());
        Batch batch = batch(program, year, "CRB" + suffix());
        Section section = section(batch, "CRS" + suffix());
        StudentEnrollment student = student(institution, department, program, batch, section,
                "CR" + suffix(), "csv-report-student-" + suffix() + "@student.test");

        Map<String, String> expectedHeaders = Map.of(
                "roster", "Student ID,Roll Number,Full Name,Department",
                "assessment-completion", "Student ID,Roll Number,Full Name,Department",
                "readiness-summary", "Student ID,Roll Number,Full Name,Department",
                "department-skill-gaps", "Department,Skill,Students Below Target",
                "batch-assessment-coverage", "Department,Program,Batch,Academic Year");
        for (var entry : expectedHeaders.entrySet()) {
            MvcResult response = mockMvc.perform(get("/api/v1/college/reports/export.csv")
                            .param("type", entry.getKey())
                            .header("Authorization", "Bearer " + admin))
                    .andExpect(status().isOk())
                    .andReturn();
            String csv = response.getResponse().getContentAsString(StandardCharsets.UTF_8);
            String header = csv.substring(csv.indexOf('\uFEFF') >= 0 ? csv.indexOf('\uFEFF') + 1 : 0,
                    csv.indexOf('\n'));
            assertThat(header).startsWith(entry.getValue());
            assertThat(header).doesNotContain("Email");
            assertThat(header).doesNotContain("Mobile");
            if (!"department-skill-gaps".equals(entry.getKey())
                    && !"batch-assessment-coverage".equals(entry.getKey())) {
                assertThat(csv).contains(student.getRollNumber());
            }
        }

        mockMvc.perform(get("/api/v1/college/reports/export.csv")
                        .param("type", "unknown")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Existing accounts cannot be elevated without proving their password")
    void existingAccountLink_requiresPassword() throws Exception {
        Institution institution = institution("LNK" + suffix());
        String admin = bootstrapAdmin(institution, "lnk-admin-" + suffix() + "@college.test");
        Department department = department(institution, "LD" + suffix());
        String email = "existing-" + suffix() + "@college.test";
        User existing = user(email, Role.STUDENT);

        JsonNode created = createInvitation(admin, "FACULTY", "DEPARTMENT", department.getId(), email);
        String token = tokenFromPath(created.path("data").path("activationPath").asText());

        mockMvc.perform(post("/api/v1/invitations/" + token + "/accept")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Existing Person\",\"password\":\"WrongPassword1\",\"termsAccepted\":true}"))
                .andExpect(status().isBadRequest());

        assertThat(userRepository.findById(existing.getId()).orElseThrow().getRole())
                .isEqualTo(Role.STUDENT);
        assertThat(membershipRepository.findByUserIdAndStatus(existing.getId(),
                com.codeit.careeros.college.enums.MembershipStatus.ACTIVE)).isEmpty();

        JsonNode accepted = accept(token, "Existing Person", PASSWORD);
        assertThat(accepted.path("data").path("user").path("role").asText()).isEqualTo("PROFESSOR");
        assertThat(userRepository.findById(existing.getId()).orElseThrow().getRole())
                .isEqualTo(Role.PROFESSOR);
        assertThat(membershipRepository.findByUserIdAndStatus(existing.getId(),
                com.codeit.careeros.college.enums.MembershipStatus.ACTIVE)).isPresent();

        // A platform-admin bootstrap link must not bypass the one-active-
        // institution-membership rule either.
        Institution other = institution("LN2" + suffix());
        String platformAdmin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        mockMvc.perform(post("/api/v1/admin/institutions/" + other.getId() + "/invitations")
                        .header("Authorization", "Bearer " + platformAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email
                                + "\",\"designation\":\"COLLEGE_ADMIN\",\"scopeType\":\"INSTITUTION\"}"))
                .andExpect(status().isConflict());
    }

    // ------------------------------------------------------------------
    // CSV import/export
    // ------------------------------------------------------------------

    @Test
    @DisplayName("CSV preview rejects invalid relationships/duplicates and export neutralises formulas")
    void csvImport_validatesAndNeutralisesFormulas() throws Exception {
        Institution institution = institution("CSV" + suffix());
        String admin = bootstrapAdmin(institution, "csv-admin-" + suffix() + "@college.test");
        Department d1 = department(institution, "D1" + suffix());
        Department d2 = department(institution, "D2" + suffix());
        AcademicYear year = academicYear(institution, "Y" + suffix());
        Program p1 = program(institution, d1, "P1" + suffix());
        Program p2 = program(institution, d2, "P2" + suffix());
        Batch batch = batch(p1, year, "B" + suffix());
        Section section = section(batch, "S" + suffix());

        String roll = "R" + suffix();
        String formulaName = "=HYPERLINK(\"http://evil.test\",\"click\")";
        String csv = "full_name,email,mobile,roll_number,department_code,program_code,batch_label,section_name,academic_year_label\n"
                + "\"" + formulaName.replace("\"", "\"\"") + "\",csv1-" + suffix() + "@student.test,9876543210,"
                + roll + "," + d1.getCode() + "," + p1.getCode() + "," + batch.getLabel() + "," + section.getName() + "," + year.getLabel() + "\n"
                + "Duplicate Roll,csv2-" + suffix() + "@student.test,,"
                + roll + "," + d1.getCode() + "," + p1.getCode() + "," + batch.getLabel() + ",, \n"
                + "Wrong Program,csv3-" + suffix() + "@student.test,,R3" + suffix() + ","
                + d1.getCode() + "," + p2.getCode() + "," + batch.getLabel() + ",,\n";

        JsonNode preview = uploadPreview(admin, csv.getBytes(StandardCharsets.UTF_8));
        long jobId = preview.path("data").path("jobId").asLong();
        assertThat(preview.path("data").path("totalRows").asInt()).isEqualTo(3);
        assertThat(preview.path("data").path("readyRows").asInt()).isEqualTo(1);
        assertThat(preview.path("data").path("rejectedRows").asInt()).isEqualTo(2);

        JsonNode commit = postJson("/api/v1/college/students/import/" + jobId + "/commit", null, admin);
        assertThat(commit.path("data").path("createdRows").asInt()).isEqualTo(1);
        assertThat(commit.path("data").path("rejectedRows").asInt()).isEqualTo(2);

        // The created student is visible and the export neutralises the formula.
        JsonNode list = getJson("/api/v1/college/students", admin);
        assertThat(list.path("data").path("items").toString()).contains(roll);
        MvcResult export = mockMvc.perform(get("/api/v1/college/students/export.csv")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn();
        String exported = export.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(exported).contains("'=HYPERLINK");
        assertThat(exported).doesNotContain("\n=HYPERLINK");
        String exportHeader = exported.substring(0, exported.indexOf('\n'));
        assertThat(exportHeader).doesNotContain("Mobile");
        assertThat(exportHeader).doesNotContain("Email");

        // The same file hash cannot be committed again within 24 hours.
        mockMvc.perform(multipart("/api/v1/college/students/import/preview")
                        .file(new MockMultipartFile("file", "students.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isConflict());

        // Row-count cap is enforced before any staging rows are written.
        StringBuilder tooMany = new StringBuilder(
                "full_name,email,mobile,roll_number,department_code,program_code,batch_label,section_name,academic_year_label\n");
        for (int i = 0; i < 1001; i++) {
            tooMany.append("Student,cap").append(i).append("-").append(suffix())
                    .append("@student.test,,R").append(i).append(suffix())
                    .append(',').append(d1.getCode()).append(',').append(p1.getCode())
                    .append(',').append(batch.getLabel()).append(",,,\n");
        }
        mockMvc.perform(multipart("/api/v1/college/students/import/preview")
                        .file(new MockMultipartFile("file", "too-many.csv", "text/csv",
                                tooMany.toString().getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("CSV escaping neutralises every dangerous leading character")
    void csvEscape_coversFormulaCharacters() {
        assertThat(StudentCsvService.escape("=1+1")).startsWith("'=");
        assertThat(StudentCsvService.escape("+1")).startsWith("'+");
        assertThat(StudentCsvService.escape("-1")).startsWith("'-");
        assertThat(StudentCsvService.escape("@cmd")).startsWith("'@");
        assertThat(StudentCsvService.escape("normal")).isEqualTo("normal");
        assertThat(StudentCsvService.escape("a,b")).isEqualTo("\"a,b\"");
        assertThat(StudentCsvService.escape("a\"b")).isEqualTo("\"a\"\"b\"");
    }

    // ------------------------------------------------------------------
    // Fixtures / HTTP helpers
    // ------------------------------------------------------------------

    private Institution institution(String code) {
        return institutionRepository.saveAndFlush(Institution.builder()
                .code(code)
                .name("Institution " + code)
                .status(InstitutionStatus.ACTIVE)
                .timezone("Asia/Kolkata")
                .build());
    }

    private Department department(Institution institution, String code) {
        return departmentRepository.saveAndFlush(Department.builder()
                .institution(institution)
                .code(code)
                .name("Department " + code)
                .status(InstitutionStatus.ACTIVE)
                .build());
    }

    private Program program(Institution institution, Department department, String code) {
        return programRepository.saveAndFlush(Program.builder()
                .institution(institution)
                .department(department)
                .code(code)
                .name("Program " + code)
                .degreeType("B.Tech")
                .durationYears(4)
                .status(InstitutionStatus.ACTIVE)
                .build());
    }

    private AcademicYear academicYear(Institution institution, String label) {
        return academicYearRepository.saveAndFlush(AcademicYear.builder()
                .institution(institution)
                .label(label)
                .startDate(java.time.LocalDate.of(2026, 6, 1))
                .endDate(java.time.LocalDate.of(2027, 5, 31))
                .active(true)
                .build());
    }

    private Batch batch(Program program, AcademicYear year, String label) {
        return batchRepository.saveAndFlush(Batch.builder()
                .program(program)
                .academicYear(year)
                .label(label)
                .graduationYear(2030)
                .status(InstitutionStatus.ACTIVE)
                .build());
    }

    private Section section(Batch batch, String name) {
        return sectionRepository.saveAndFlush(Section.builder()
                .batch(batch)
                .name(name)
                .status(InstitutionStatus.ACTIVE)
                .build());
    }

    private User user(String email, Role role) {
        String normalized = email.toLowerCase(java.util.Locale.ROOT);
        return userRepository.saveAndFlush(User.builder()
                .email(normalized)
                .passwordHash(passwordEncoder.encode(PASSWORD))
                .fullName("User " + normalized)
                .role(role)
                .status(UserStatus.ACTIVE)
                .build());
    }

    private StudentEnrollment student(Institution institution, Department department, Program program,
                                      Batch batch, Section section, String roll, String email) {
        User user = user(email, Role.STUDENT);
        StudentProfile profile = studentProfileRepository.saveAndFlush(StudentProfile.builder()
                .user(user)
                .studentId("S" + UUID.randomUUID().toString().replace("-", "").substring(0, 10))
                .fullName("Student " + roll)
                .semester(6)
                .build());
        return enrollmentRepository.saveAndFlush(StudentEnrollment.builder()
                .studentProfile(profile)
                .institution(institution)
                .department(department)
                .program(program)
                .batch(batch)
                .section(section)
                .rollNumber(roll)
                .status(EnrollmentStatus.ACTIVE)
                .build());
    }

    private String login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
    }

    private String bootstrapAdmin(Institution institution, String email) throws Exception {
        String admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        JsonNode created = postJson("/api/v1/admin/institutions/" + institution.getId() + "/invitations",
                "{\"email\":\"" + email + "\",\"designation\":\"COLLEGE_ADMIN\",\"scopeType\":\"INSTITUTION\"}",
                admin);
        String token = tokenFromPath(created.path("data").path("activationPath").asText());
        return accept(token, "College Admin", PASSWORD).path("data").path("accessToken").asText();
    }

    private JsonNode createInvitation(String adminToken, String designation, String scopeType,
                                      Long scopeId, String email) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"designation\":\"" + designation
                + "\",\"scopeType\":\"" + scopeType + "\""
                + (scopeId == null ? "" : ",\"scopeId\":" + scopeId) + "}";
        return postJson("/api/v1/college/staff/invitations", body, adminToken);
    }

    private JsonNode accept(String token, String fullName, String password) throws Exception {
        return postJson("/api/v1/invitations/" + token + "/accept",
                acceptBody(fullName, password), null);
    }

    private static String acceptBody(String fullName, String password) {
        return "{\"fullName\":\"" + fullName + "\",\"password\":\"" + password
                + "\",\"termsAccepted\":true}";
    }

    private JsonNode postJson(String path, String body, String token) throws Exception {
        var request = post(path).contentType(MediaType.APPLICATION_JSON);
        if (body != null) {
            request.content(body);
        }
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode getJson(String path, String token) throws Exception {
        var request = get(path);
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode uploadPreview(String token, byte[] content) throws Exception {
        MvcResult result = mockMvc.perform(multipart("/api/v1/college/students/import/preview")
                        .file(new MockMultipartFile("file", "students.csv", "text/csv", content))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private static String tokenFromPath(String path) {
        int index = path.indexOf("token=");
        return index < 0 ? path : path.substring(index + "token=".length());
    }

    private static String suffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
    }
}


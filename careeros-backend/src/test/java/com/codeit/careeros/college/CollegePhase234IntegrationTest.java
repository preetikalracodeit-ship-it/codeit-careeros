package com.codeit.careeros.college;

import com.codeit.careeros.college.entity.AcademicYear;
import com.codeit.careeros.college.entity.Batch;
import com.codeit.careeros.college.entity.Department;
import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.college.entity.Program;
import com.codeit.careeros.college.entity.Section;
import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.college.enums.InstitutionStatus;
import com.codeit.careeros.college.repository.AcademicYearRepository;
import com.codeit.careeros.college.repository.BatchRepository;
import com.codeit.careeros.college.repository.DepartmentRepository;
import com.codeit.careeros.college.repository.InstitutionMembershipRepository;
import com.codeit.careeros.college.repository.InstitutionRepository;
import com.codeit.careeros.college.repository.ProgramRepository;
import com.codeit.careeros.college.repository.SectionRepository;
import com.codeit.careeros.college.repository.StaffInvitationRepository;
import com.codeit.careeros.college.repository.StudentEnrollmentRepository;
import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.common.enums.UserStatus;
import com.codeit.careeros.entity.AuditEvent;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.improvement.repository.ImprovementPlanRepository;
import com.codeit.careeros.improvement.repository.ImprovementTaskRepository;
import com.codeit.careeros.placement.repository.ApplicationStageEventRepository;
import com.codeit.careeros.placement.repository.CompanyRepository;
import com.codeit.careeros.placement.repository.JobOpeningRepository;
import com.codeit.careeros.placement.repository.PlacementApplicationRepository;
import com.codeit.careeros.placement.repository.PlacementDriveRepository;
import com.codeit.careeros.placement.repository.PlacementOfferRepository;
import com.codeit.careeros.repository.AuditEventRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 2/3/4 integration coverage: tenant isolation for companies, jobs,
 * drives, applications and plans; eligibility overrides; offer/joining
 * outcomes; analytics denominators; formula-safe exports and audit creation.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CollegePhase234IntegrationTest {

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
    @Autowired private CompanyRepository companyRepository;
    @Autowired private JobOpeningRepository jobRepository;
    @Autowired private PlacementDriveRepository driveRepository;
    @Autowired private PlacementApplicationRepository applicationRepository;
    @Autowired private ApplicationStageEventRepository stageEventRepository;
    @Autowired private PlacementOfferRepository offerRepository;
    @Autowired private ImprovementPlanRepository planRepository;
    @Autowired private ImprovementTaskRepository taskRepository;
    @Autowired private AuditEventRepository auditEventRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @AfterEach
    void clean() {
        taskRepository.deleteAll();
        planRepository.deleteAll();
        stageEventRepository.deleteAll();
        offerRepository.deleteAll();
        applicationRepository.deleteAll();
        driveRepository.deleteAll();
        jobRepository.deleteAll();
        companyRepository.deleteAll();
        enrollmentRepository.deleteAll();
        invitationRepository.deleteAll();
        membershipRepository.deleteAll();
    }

    @Test
    @DisplayName("Placement companies, drives and applications are tenant and department scoped")
    void placement_isTenantAndDepartmentScoped() throws Exception {
        Institution a = institution("P2A" + suffix());
        String adminA = bootstrapAdmin(a, "p2-admin-" + suffix() + "@college.test");
        Department d1 = department(a, "P2D1" + suffix());
        Department d2 = department(a, "P2D2" + suffix());
        AcademicYear year = academicYear(a, "P2Y" + suffix());
        Program p1 = program(a, d1, "P2P1" + suffix());
        Program p2 = program(a, d2, "P2P2" + suffix());
        Batch b1 = batch(p1, year, "P2B1" + suffix());
        Batch b2 = batch(p2, year, "P2B2" + suffix());
        Section s1 = section(b1, "P2S1" + suffix());
        Section s2 = section(b2, "P2S2" + suffix());
        StudentEnrollment student1 = student(a, d1, p1, b1, s1, "P2R1" + suffix(),
                "p2s1-" + suffix() + "@student.test");
        StudentEnrollment student2 = student(a, d2, p2, b2, s2, "P2R2" + suffix(),
                "p2s2-" + suffix() + "@student.test");

        Institution b = institution("P2B" + suffix());
        String adminB = bootstrapAdmin(b, "p2b-admin-" + suffix() + "@college.test");

        JsonNode company = postJson("/api/v1/college/placement/companies", """
                {"name":"=Acme %s","industry":"Software","contactEmail":"tpo@acme.test",
                 "recruitmentStatus":"ACTIVE","source":"Referral","notes":"Call 9999999999"}
                """.formatted(suffix()), adminA);
        long companyId = company.path("data").path("id").asLong();

        JsonNode job = postJson("/api/v1/college/placement/jobs", """
                {"companyId":%d,"title":"Graduate Engineer","requiredSkills":"Java,SQL",
                 "employmentType":"FULL_TIME","status":"OPEN","salaryMin":500000,"salaryMax":800000,
                 "currency":"INR"}
                """.formatted(companyId), adminA);
        long jobId = job.path("data").path("id").asLong();

        JsonNode drive = postJson("/api/v1/college/placement/drives", """
                {"companyId":%d,"jobId":%d,"name":"Acme Campus Drive","status":"REGISTRATION_OPEN",
                 "registrationStart":"%s","registrationEnd":"%s",
                 "eligibleDepartmentId":%d,"eligibleProgramId":%d,"eligibleBatchId":%d}
                """.formatted(companyId, jobId, LocalDate.now().minusDays(1), LocalDate.now().plusDays(10),
                d1.getId(), p1.getId(), b1.getId()), adminA);
        long driveId = drive.path("data").path("id").asLong();

        // Another tenant cannot see the company or open the drive.
        JsonNode bCompanies = getJson("/api/v1/college/placement/companies", adminB);
        assertThat(bCompanies.path("data").toString()).doesNotContain("Acme");
        mockMvc.perform(get("/api/v1/college/placement/drives/" + driveId)
                        .header("Authorization", "Bearer " + adminB))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/college/placement/drives/" + driveId + "/applications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enrollmentId\":" + student1.getId() + "}")
                        .header("Authorization", "Bearer " + adminB))
                .andExpect(status().isNotFound());

        // Department-scoped HOD for D2 cannot see or open a D1 drive.
        String hodD2 = inviteAndAccept(adminA, "HOD", "DEPARTMENT", d2.getId(),
                "p2-hod-" + suffix() + "@college.test");
        JsonNode hodDrives = getJson("/api/v1/college/placement/drives", hodD2);
        assertThat(hodDrives.path("data").toString()).doesNotContain("Acme Campus Drive");
        mockMvc.perform(get("/api/v1/college/placement/drives/" + driveId)
                        .header("Authorization", "Bearer " + hodD2))
                .andExpect(status().isNotFound());
        // HOD can see a drive targeted at their own department.
        String hodD1 = inviteAndAccept(adminA, "HOD", "DEPARTMENT", d1.getId(),
                "p2-hod1-" + suffix() + "@college.test");
        JsonNode hodDrivesD1 = getJson("/api/v1/college/placement/drives", hodD1);
        assertThat(hodDrivesD1.path("data").toString()).contains("Acme Campus Drive");
        JsonNode hodCompaniesD1 = getJson("/api/v1/college/placement/companies", hodD1);
        assertThat(hodCompaniesD1.path("data").toString())
                .contains("Acme")
                .doesNotContain("tpo@acme.test")
                .doesNotContain("9999999999");

        // HOD cannot mutate placement data.
        mockMvc.perform(post("/api/v1/college/placement/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Forbidden\"}")
                        .header("Authorization", "Bearer " + hodD1))
                .andExpect(status().isForbidden());

        // Eligible student registers; duplicate is rejected.
        String student1Token = login(student1.getStudentProfile().getUser().getEmail(), PASSWORD);
        JsonNode application = postJson("/api/v1/students/me/placement/drives/" + driveId + "/register",
                null, student1Token);
        long applicationId = application.path("data").path("id").asLong();
        mockMvc.perform(post("/api/v1/students/me/placement/drives/" + driveId + "/register")
                        .header("Authorization", "Bearer " + student1Token))
                .andExpect(status().isConflict());

        // Ineligible student is rejected without an override; staff override is audited.
        String student2Token = login(student2.getStudentProfile().getUser().getEmail(), PASSWORD);
        mockMvc.perform(post("/api/v1/students/me/placement/drives/" + driveId + "/register")
                        .header("Authorization", "Bearer " + student2Token))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/college/placement/drives/" + driveId + "/applications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enrollmentId\":" + student2.getId() + ",\"override\":true,"
                                + "\"overrideReason\":\"Approved by TPO for a special case\"}")
                        .header("Authorization", "Bearer " + adminA))
                .andExpect(status().isOk());

        // Stage history, offer and joining outcome are recorded separately.
        patchJson("/api/v1/college/placement/applications/" + applicationId,
                "{\"stage\":\"ASSESSMENT\",\"note\":\"Aptitude round\"}", adminA);
        JsonNode offer = postJson("/api/v1/college/placement/applications/" + applicationId + "/offer",
                "{\"packageAmount\":750000,\"currency\":\"INR\",\"status\":\"PENDING\"}", adminA);
        long offerId = offer.path("data").path("id").asLong();
        patchJson("/api/v1/students/me/placement/offers/" + offerId + "/respond?status=ACCEPTED",
                null, student1Token);
        patchJson("/api/v1/college/placement/offers/" + offerId,
                "{\"status\":\"JOINED\",\"joinedAt\":\"" + LocalDate.now() + "\"}", adminA);

        JsonNode analytics = getJson("/api/v1/college/placement/analytics", adminA);
        assertThat(analytics.path("data").path("eligibleGraduatingStudents").asInt()).isEqualTo(2);
        assertThat(analytics.path("data").path("driveParticipants").asInt()).isEqualTo(2);
        assertThat(analytics.path("data").path("offersMade").asInt()).isEqualTo(1);
        assertThat(analytics.path("data").path("studentsWithOffer").asInt()).isEqualTo(1);
        assertThat(analytics.path("data").path("acceptedOffers").asInt()).isEqualTo(1);
        assertThat(analytics.path("data").path("joinedStudents").asInt()).isEqualTo(1);
        assertThat(analytics.path("data").path("placementRate").asInt()).isEqualTo(50);
        assertThat(analytics.path("data").path("denominatorDefinition").asText()).contains("graduation year");

        // Formula-bearing company names are neutralised in CSV exports.
        MvcResult export = mockMvc.perform(get("/api/v1/college/placement/analytics/export.csv")
                        .param("type", "company-outcomes")
                        .header("Authorization", "Bearer " + adminA))
                .andExpect(status().isOk())
                .andReturn();
        String csv = export.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).contains("'=Acme");
        assertThat(csv).doesNotContain("\n=Acme");

        // Cross-tenant analytics and exports remain scoped.
        mockMvc.perform(get("/api/v1/college/placement/analytics")
                        .header("Authorization", "Bearer " + adminB))
                .andExpect(status().isOk());

        List<AuditEvent> events = auditEventRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(event -> a.getId().equals(event.getInstitutionId()))
                .toList();
        assertThat(events).anyMatch(event -> "PLACEMENT_DRIVE_CREATE".equals(event.getAction()));
        assertThat(events).anyMatch(event -> "PLACEMENT_APPLICATION_CREATE".equals(event.getAction()));
        assertThat(events).anyMatch(event -> "PLACEMENT_OFFER_UPDATE".equals(event.getAction()));
        assertThat(events).anyMatch(event -> "PLACEMENT_REPORT_EXPORT".equals(event.getAction()));
    }

    @Test
    @DisplayName("Improvement plans are scoped, evidence-gated and student-readable")
    void improvementPlans_areScopedAndEvidenceGated() throws Exception {
        Institution a = institution("IP" + suffix());
        String adminA = bootstrapAdmin(a, "ip-admin-" + suffix() + "@college.test");
        Department d1 = department(a, "IPD" + suffix());
        AcademicYear year = academicYear(a, "IPY" + suffix());
        Program p1 = program(a, d1, "IPP" + suffix());
        Batch b1 = batch(p1, year, "IPB" + suffix());
        Section s1 = section(b1, "IPS" + suffix());
        StudentEnrollment student = student(a, d1, p1, b1, s1, "IPR" + suffix(),
                "ip-student-" + suffix() + "@student.test");

        Institution b = institution("IPB" + suffix());
        String adminB = bootstrapAdmin(b, "ipb-admin-" + suffix() + "@college.test");

        // No assessment evidence: generation is rejected rather than inventing a gap.
        mockMvc.perform(post("/api/v1/college/improvement-plans/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enrollmentId\":" + student.getId() + "}")
                        .header("Authorization", "Bearer " + adminA))
                .andExpect(status().isBadRequest());

        JsonNode plan = postJson("/api/v1/college/improvement-plans", """
                {"enrollmentId":%d,"title":"Targeted preparation","summary":"Manual plan",
                 "tasks":[{"title":"Complete Java practice set","priority":"HIGH",
                 "targetDate":"%s"}]}
                """.formatted(student.getId(), LocalDate.now().plusDays(14)), adminA);
        long planId = plan.path("data").path("id").asLong();
        long taskId = plan.path("data").path("tasks").get(0).path("id").asLong();

        String studentToken = login(student.getStudentProfile().getUser().getEmail(), PASSWORD);
        JsonNode myPlans = getJson("/api/v1/students/me/improvement-plans", studentToken);
        assertThat(myPlans.path("data").path("total").asInt()).isEqualTo(1);
        patchJson("/api/v1/students/me/improvement-plans/tasks/" + taskId,
                "{\"status\":\"COMPLETED\"}", studentToken);

        JsonNode updated = getJson("/api/v1/college/improvement-plans/" + planId, adminA);
        assertThat(updated.path("data").path("completedTasks").asInt()).isEqualTo(1);
        assertThat(updated.path("data").path("progressPercent").asInt()).isEqualTo(100);

        mockMvc.perform(get("/api/v1/college/improvement-plans/" + planId)
                        .header("Authorization", "Bearer " + adminB))
                .andExpect(status().isNotFound());

        String faculty = inviteAndAccept(adminA, "FACULTY", "SECTION", s1.getId(),
                "ip-faculty-" + suffix() + "@college.test");
        mockMvc.perform(post("/api/v1/college/improvement-plans")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enrollmentId\":" + student.getId() + ",\"title\":\"Faculty plan\"}")
                        .header("Authorization", "Bearer " + faculty))
                .andExpect(status().isForbidden());

        List<AuditEvent> events = auditEventRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(event -> a.getId().equals(event.getInstitutionId()))
                .toList();
        assertThat(events).anyMatch(event -> "IMPROVEMENT_PLAN_CREATE".equals(event.getAction()));
        assertThat(events).anyMatch(event -> "IMPROVEMENT_TASK_UPDATE".equals(event.getAction()));
    }

    @Test
    @DisplayName("Placement rejects mismatched academic targets and invalid offers, and analytics exclude non-graduating students")
    void placement_validatesHierarchyOffersAndGraduatingDenominator() throws Exception {
        Institution a = institution("PV" + suffix());
        String adminA = bootstrapAdmin(a, "pv-admin-" + suffix() + "@college.test");
        Department d1 = department(a, "PVD1" + suffix());
        Department d2 = department(a, "PVD2" + suffix());
        AcademicYear year = academicYear(a, "PVY" + suffix());
        Program p1 = program(a, d1, "PVP1" + suffix());
        Program p2 = program(a, d2, "PVP2" + suffix());
        Batch b1 = batch(p1, year, "PVB1" + suffix());
        Batch b2 = batch(p2, year, "PVB2" + suffix());
        Section s1 = section(b1, "PVS1" + suffix());
        Section s2 = section(b2, "PVS2" + suffix());
        StudentEnrollment graduating = student(a, d1, p1, b1, s1, "PVR1" + suffix(),
                "pv-graduating-" + suffix() + "@student.test");
        StudentEnrollment notGraduating = student(a, d2, p2, b2, s2, "PVR2" + suffix(),
                "pv-future-" + suffix() + "@student.test");
        // The second student's batch is far in the future and must not enter the placement denominator.
        b2.setGraduationYear(2099);
        b2 = batchRepository.saveAndFlush(b2);

        JsonNode company = postJson("/api/v1/college/placement/companies",
                "{\"name\":\"Validated Co " + suffix() + "\",\"recruitmentStatus\":\"ACTIVE\"}", adminA);
        long companyId = company.path("data").path("id").asLong();
        JsonNode job = postJson("/api/v1/college/placement/jobs",
                "{\"companyId\":" + companyId + ",\"title\":\"Graduate Engineer\",\"status\":\"OPEN\"}",
                adminA);
        long jobId = job.path("data").path("id").asLong();

        mockMvc.perform(post("/api/v1/college/placement/drives")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":" + companyId + ",\"jobId\":" + jobId
                                + ",\"name\":\"Mismatched department and program\",\"status\":\"DRAFT\""
                                + ",\"eligibleDepartmentId\":" + d1.getId()
                                + ",\"eligibleProgramId\":" + p2.getId() + "}")
                        .header("Authorization", "Bearer " + adminA))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/college/placement/drives")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":" + companyId + ",\"jobId\":" + jobId
                                + ",\"name\":\"Mismatched program and batch\",\"status\":\"DRAFT\""
                                + ",\"eligibleProgramId\":" + p1.getId()
                                + ",\"eligibleBatchId\":" + b2.getId() + "}")
                        .header("Authorization", "Bearer " + adminA))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/college/placement/drives")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":" + companyId + ",\"jobId\":" + jobId
                                + ",\"name\":\"Invalid graduation year\",\"status\":\"DRAFT\""
                                + ",\"eligibleGraduationYear\":1900}")
                        .header("Authorization", "Bearer " + adminA))
                .andExpect(status().isBadRequest());

        JsonNode drive = postJson("/api/v1/college/placement/drives",
                "{\"companyId\":" + companyId + ",\"jobId\":" + jobId
                        + ",\"name\":\"Validated Drive\",\"status\":\"REGISTRATION_OPEN\""
                        + ",\"eligibleDepartmentId\":" + d1.getId()
                        + ",\"eligibleProgramId\":" + p1.getId()
                        + ",\"eligibleBatchId\":" + b1.getId() + "}", adminA);
        long driveId = drive.path("data").path("id").asLong();

        JsonNode application = postJson("/api/v1/college/placement/drives/" + driveId + "/applications",
                "{\"enrollmentId\":" + graduating.getId() + "}", adminA);
        long applicationId = application.path("data").path("id").asLong();
        postJson("/api/v1/college/placement/drives/" + driveId + "/applications",
                "{\"enrollmentId\":" + notGraduating.getId() + ",\"override\":true"
                        + ",\"overrideReason\":\"Eligibility override for denominator test\"}", adminA);

        mockMvc.perform(post("/api/v1/college/placement/applications/" + applicationId + "/offer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"packageAmount\":-1,\"currency\":\"INR\",\"status\":\"PENDING\"}")
                        .header("Authorization", "Bearer " + adminA))
                .andExpect(status().isBadRequest());

        JsonNode offer = postJson("/api/v1/college/placement/applications/" + applicationId + "/offer",
                "{\"packageAmount\":600000,\"currency\":\"INR\",\"status\":\"PENDING\"}", adminA);
        long offerId = offer.path("data").path("id").asLong();
        String studentToken = login(graduating.getStudentProfile().getUser().getEmail(), PASSWORD);
        patchJson("/api/v1/students/me/placement/offers/" + offerId + "/respond?status=ACCEPTED",
                null, studentToken);
        patchJson("/api/v1/college/placement/offers/" + offerId,
                "{\"status\":\"JOINED\",\"joinedAt\":\"" + LocalDate.now() + "\"}", adminA);
        mockMvc.perform(patch("/api/v1/students/me/placement/offers/" + offerId + "/respond")
                        .param("status", "DECLINED")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isBadRequest());

        JsonNode analytics = getJson("/api/v1/college/placement/analytics", adminA);
        assertThat(analytics.path("data").path("eligibleGraduatingStudents").asInt()).isEqualTo(1);
        assertThat(analytics.path("data").path("driveParticipants").asInt()).isEqualTo(1);
        assertThat(analytics.path("data").path("offersMade").asInt()).isEqualTo(1);
        assertThat(analytics.path("data").path("studentsWithOffer").asInt()).isEqualTo(1);
        assertThat(analytics.path("data").path("joinedStudents").asInt()).isEqualTo(1);
        assertThat(analytics.path("data").path("placementRate").asInt()).isEqualTo(100);

        // A drive PUT replaces the editable definition, so an administrator can
        // clear previously selected eligibility targets instead of silently
        // retaining them.
        JsonNode clearedDrive = putJson("/api/v1/college/placement/drives/" + driveId,
                "{\"companyId\":" + companyId + ",\"jobId\":" + jobId
                        + ",\"name\":\"Validated Drive\",\"status\":\"REGISTRATION_OPEN\"}", adminA);
        assertThat(clearedDrive.path("data").has("eligibleDepartmentId")).isFalse();
        assertThat(clearedDrive.path("data").has("eligibleProgramId")).isFalse();
        assertThat(clearedDrive.path("data").has("eligibleBatchId")).isFalse();

        JsonNode otherCompany = postJson("/api/v1/college/placement/companies",
                "{\"name\":\"Other Co " + suffix() + "\",\"recruitmentStatus\":\"ACTIVE\"}", adminA);
        mockMvc.perform(put("/api/v1/college/placement/drives/" + driveId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":" + otherCompany.path("data").path("id").asLong()
                                + ",\"jobId\":" + jobId + ",\"name\":\"Mismatched company and job\"}")
                        .header("Authorization", "Bearer " + adminA))
                .andExpect(status().isBadRequest());

        // Changing an offer away from JOINED clears the joining date so the
        // analytics denominator does not keep counting a stale outcome.
        patchJson("/api/v1/college/placement/offers/" + offerId,
                "{\"status\":\"ACCEPTED\"}", adminA);
        JsonNode afterAccepted = getJson("/api/v1/college/placement/analytics", adminA);
        assertThat(afterAccepted.path("data").path("acceptedOffers").asInt()).isEqualTo(1);
        assertThat(afterAccepted.path("data").path("joinedStudents").asInt()).isZero();

        // A student withdrawal also withdraws any non-joined offer.
        patchJson("/api/v1/students/me/placement/applications/" + applicationId + "/withdraw",
                null, studentToken);
        JsonNode afterWithdraw = getJson("/api/v1/college/placement/analytics", adminA);
        assertThat(afterWithdraw.path("data").path("driveParticipants").asInt()).isZero();
        assertThat(afterWithdraw.path("data").path("studentsWithOffer").asInt()).isZero();
        assertThat(afterWithdraw.path("data").path("acceptedOffers").asInt()).isZero();
        assertThat(afterWithdraw.path("data").path("joinedStudents").asInt()).isZero();
    }

    // ---- fixtures / helpers ----

    private Institution institution(String code) {
        return institutionRepository.saveAndFlush(Institution.builder()
                .code(code).name("Institution " + code).status(InstitutionStatus.ACTIVE)
                .timezone("Asia/Kolkata").build());
    }

    private Department department(Institution institution, String code) {
        return departmentRepository.saveAndFlush(Department.builder()
                .institution(institution).code(code).name("Department " + code)
                .status(InstitutionStatus.ACTIVE).build());
    }

    private Program program(Institution institution, Department department, String code) {
        return programRepository.saveAndFlush(Program.builder()
                .institution(institution).department(department).code(code).name("Program " + code)
                .degreeType("B.Tech").durationYears(4).status(InstitutionStatus.ACTIVE).build());
    }

    private AcademicYear academicYear(Institution institution, String label) {
        return academicYearRepository.saveAndFlush(AcademicYear.builder()
                .institution(institution).label(label)
                .startDate(LocalDate.of(2026, 6, 1)).endDate(LocalDate.of(2027, 5, 31))
                .active(true).build());
    }

    private Batch batch(Program program, AcademicYear year, String label) {
        return batchRepository.saveAndFlush(Batch.builder()
                .program(program).academicYear(year).label(label).graduationYear(2026)
                .status(InstitutionStatus.ACTIVE).build());
    }

    private Section section(Batch batch, String name) {
        return sectionRepository.saveAndFlush(Section.builder()
                .batch(batch).name(name).status(InstitutionStatus.ACTIVE).build());
    }

    private User user(String email, Role role) {
        String normalized = email.toLowerCase(java.util.Locale.ROOT);
        return userRepository.saveAndFlush(User.builder()
                .email(normalized).passwordHash(passwordEncoder.encode(PASSWORD))
                .fullName("User " + normalized).role(role).status(UserStatus.ACTIVE).build());
    }

    private StudentEnrollment student(Institution institution, Department department, Program program,
                                      Batch batch, Section section, String roll, String email) {
        User user = user(email, Role.STUDENT);
        StudentProfile profile = studentProfileRepository.saveAndFlush(StudentProfile.builder()
                .user(user).studentId("S" + UUID.randomUUID().toString().replace("-", "").substring(0, 10))
                .fullName("Student " + roll).semester(6).build());
        return enrollmentRepository.saveAndFlush(StudentEnrollment.builder()
                .studentProfile(profile).institution(institution).department(department)
                .program(program).batch(batch).section(section).rollNumber(roll)
                .status(EnrollmentStatus.ACTIVE).build());
    }

    private String login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
    }

    private String bootstrapAdmin(Institution institution, String email) throws Exception {
        String admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        JsonNode created = postJson("/api/v1/admin/institutions/" + institution.getId() + "/invitations",
                "{\"email\":\"" + email + "\",\"designation\":\"COLLEGE_ADMIN\",\"scopeType\":\"INSTITUTION\"}",
                admin);
        return accept(tokenFromPath(created.path("data").path("activationPath").asText()));
    }

    private String inviteAndAccept(String adminToken, String designation, String scopeType,
                                   Long scopeId, String email) throws Exception {
        JsonNode created = postJson("/api/v1/college/staff/invitations",
                "{\"email\":\"" + email + "\",\"designation\":\"" + designation
                        + "\",\"scopeType\":\"" + scopeType + "\",\"scopeId\":" + scopeId + "}",
                adminToken);
        return accept(tokenFromPath(created.path("data").path("activationPath").asText()));
    }

    private String accept(String token) throws Exception {
        JsonNode accepted = postJson("/api/v1/invitations/" + token + "/accept",
                "{\"fullName\":\"Staff Person\",\"password\":\"" + PASSWORD + "\",\"termsAccepted\":true}",
                null);
        return accepted.path("data").path("accessToken").asText();
    }

    private JsonNode postJson(String path, String body, String token) throws Exception {
        var request = post(path).contentType(MediaType.APPLICATION_JSON);
        if (body != null) request.content(body);
        if (token != null) request.header("Authorization", "Bearer " + token);
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode patchJson(String path, String body, String token) throws Exception {
        var request = patch(path).contentType(MediaType.APPLICATION_JSON);
        if (body != null) request.content(body);
        if (token != null) request.header("Authorization", "Bearer " + token);
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode putJson(String path, String body, String token) throws Exception {
        var request = put(path).contentType(MediaType.APPLICATION_JSON);
        if (body != null) request.content(body);
        if (token != null) request.header("Authorization", "Bearer " + token);
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode getJson(String path, String token) throws Exception {
        MvcResult result = mockMvc.perform(get(path)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
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

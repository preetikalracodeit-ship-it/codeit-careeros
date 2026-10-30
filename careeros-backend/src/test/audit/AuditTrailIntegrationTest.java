package com.codeit.careeros.audit;

import com.codeit.careeros.TestSupport;
import com.codeit.careeros.entity.AuditEvent;
import com.codeit.careeros.repository.AuditEventRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuditTrailIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AuditEventRepository auditEventRepository;

    private List<AuditEvent> eventsFor(String action) {
        return auditEventRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(event -> action.equals(event.getAction()))
                .toList();
    }

    @Test
    @DisplayName("An admin write is recorded with actor, route, outcome and request id")
    void adminWrite_isAudited() throws Exception {
        String requestId = "audit-" + UUID.randomUUID().toString().substring(0, 12);
        String skillName = "AuditSkill" + UUID.randomUUID().toString().substring(0, 8);

        mockMvc.perform(post("/api/v1/admin/skills")
                        .header("Authorization", "Bearer " + adminToken())
                        .header("X-Request-Id", requestId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "%s",
                                  "category": "OTHER",
                                  "description": "super-secret-description"
                                }
                                """.formatted(skillName)))
                .andExpect(status().isOk());

        List<AuditEvent> events = eventsFor("POST /api/v1/admin/skills");
        assertThat(events).isNotEmpty();
        AuditEvent event = events.stream()
                .filter(e -> requestId.equals(e.getRequestId()))
                .findFirst().orElseThrow();
        assertThat(event.getActorUserId()).isNotNull();
        assertThat(event.getActorRole()).isEqualTo("ADMIN");
        assertThat(event.getTargetPath()).isEqualTo("/api/v1/admin/skills");
        assertThat(event.getOutcome()).isEqualTo("SUCCESS");
        assertThat(event.getHttpStatus()).isEqualTo(200);
        assertThat(event.getRequestId()).isEqualTo(requestId);

        // No request body content (or credentials) may leak into the audit row.
        assertThat(event.getAction()).doesNotContain("super-secret-description");
        assertThat(event.getTargetPath()).doesNotContain("super-secret-description");
        assertThat(event.getRequestId()).doesNotContain("super-secret-description");
    }

    @Test
    @DisplayName("A rejected admin write is recorded as an error")
    void adminValidationFailure_isAudited() throws Exception {
        mockMvc.perform(post("/api/v1/admin/skills")
                        .header("Authorization", "Bearer " + adminToken())
                        .header("X-Request-Id", "audit-invalid-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "", "category": "OTHER"}
                                """))
                .andExpect(status().isBadRequest());

        AuditEvent event = eventsFor("POST /api/v1/admin/skills").stream()
                .filter(e -> "audit-invalid-1".equals(e.getRequestId()))
                .findFirst().orElseThrow();
        assertThat(event.getOutcome()).isEqualTo("ERROR");
        assertThat(event.getHttpStatus()).isEqualTo(400);
        assertThat(event.getActorRole()).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("A student's denied admin request is recorded without granting access")
    void studentDeniedAdminAccess_isAudited() throws Exception {
        String email = "audit-student@test.local";
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Audit Student",
                                  "email": "%s",
                                  "mobile": "9876543210",
                                  "password": "Password1",
                                  "termsAccepted": true
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        String token = TestSupport.token(reg, "accessToken");

        mockMvc.perform(get("/api/v1/admin/skills")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Request-Id", "audit-denied-1"))
                .andExpect(status().isForbidden());

        AuditEvent event = auditEventRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(e -> "audit-denied-1".equals(e.getRequestId()))
                .findFirst().orElseThrow();
        assertThat(event.getOutcome()).isEqualTo("DENIED");
        assertThat(event.getHttpStatus()).isEqualTo(403);
        assertThat(event.getActorRole()).isEqualTo("STUDENT");
        assertThat(event.getAction()).isEqualTo("GET /api/v1/admin/skills");
    }

    private String adminToken() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "admin@test.local",
                                  "password": "Admin@123Test"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();
        return TestSupport.token(login, "accessToken");
    }
}

package com.codeit.careeros.admin;

import com.codeit.careeros.TestSupport;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminReadOnlyModulesIntegrationTest {

    private static final String[] ENDPOINTS = {
            "/api/v1/admin/ai/status",
            "/api/v1/admin/roadmaps",
            "/api/v1/admin/projects",
    };

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Anonymous access to read-only admin modules returns 401")
    void readOnlyModules_anonymous_unauthorized() throws Exception {
        for (String endpoint : ENDPOINTS) {
            mockMvc.perform(get(endpoint))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    @DisplayName("STUDENT cannot access read-only admin modules (403)")
    void readOnlyModules_student_forbidden() throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Readonly Browser",
                                  "email": "readonly-browse@test.local",
                                  "mobile": "9876543210",
                                  "password": "Password1", "termsAccepted": true}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        String studentToken = TestSupport.token(reg, "accessToken");

        for (String endpoint : ENDPOINTS) {
            mockMvc.perform(get(endpoint)
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    @DisplayName("ADMIN can browse AI status, roadmap templates and project catalog")
    void readOnlyModules_admin_ok() throws Exception {
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
        String adminToken = TestSupport.token(login, "accessToken");

        mockMvc.perform(get("/api/v1/admin/ai/status")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.provider").isString())
                .andExpect(jsonPath("$.data.mode").isString())
                .andExpect(jsonPath("$.data.maxToolIterations").isNumber())
                .andExpect(jsonPath("$.data.apiKey").doesNotExist())
                .andExpect(jsonPath("$.data.geminiApiKey").doesNotExist());

        mockMvc.perform(get("/api/v1/admin/roadmaps")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        mockMvc.perform(get("/api/v1/admin/projects")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }
}

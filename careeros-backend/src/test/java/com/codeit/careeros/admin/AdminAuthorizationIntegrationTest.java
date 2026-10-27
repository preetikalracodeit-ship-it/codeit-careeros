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

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminAuthorizationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Anonymous access to admin endpoint returns 401")
    void admin_anonymous_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/admin/students"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("STUDENT cannot access admin endpoints (403)")
    void admin_studentRoute_forbidden() throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Blocked Student",
                                  "email": "blocked@test.local",
                                  "mobile": "9876543210",
                                  "password": "Password1", "termsAccepted": true}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        String studentToken = TestSupport.token(reg, "accessToken");

        mockMvc.perform(get("/api/v1/admin/students")
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("ADMIN role can access admin endpoints")
    void admin_authorized() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "admin@test.local",
                                  "password": "Admin@123Test"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.role").value("ADMIN"))
                .andReturn();
        String adminToken = TestSupport.token(login, "accessToken");

        mockMvc.perform(get("/api/v1/admin/me")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("ADMIN"));

        mockMvc.perform(get("/api/v1/admin/students")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());

        mockMvc.perform(get("/api/v1/admin/students/count")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.count").isNumber());
    }

    @Test
    @DisplayName("ADMIN student search filters the full result set before pagination")
    void admin_studentSearch_isAppliedAcrossPages() throws Exception {
        String email = "search-" + UUID.randomUUID() + "@test.local";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Searchable Student",
                                  "email": "%s",
                                  "mobile": "9876543210",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email)))
                .andExpect(status().isCreated());

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

        mockMvc.perform(get("/api/v1/admin/students")
                        .param("page", "0")
                        .param("size", "1")
                        .param("search", email)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content.length()").value(1))
                .andExpect(jsonPath("$.data.content[0].email").value(email));
    }
}

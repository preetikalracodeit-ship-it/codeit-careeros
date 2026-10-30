package com.codeit.careeros.student;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StudentProfileIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Students/me returns the profile created during registration")
    void getProfile_createdOnRegistration() throws Exception {
        MvcResult reg = register("profile1@test.local");
        String token = TestSupport.token(reg, "accessToken");

        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("profile1@test.local"))
                .andExpect(jsonPath("$.data.fullName").value("Student profile1@test.local"))
                .andExpect(jsonPath("$.data.studentId").value(org.hamcrest.Matchers.startsWith("STU")))
                .andExpect(jsonPath("$.data.semester").value(1));
    }

    @Test
    @DisplayName("Students/me rejects an invalid token")
    void getProfile_invalidToken_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer not.a.valid.token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Profile can be updated and changes persist")
    void updateProfile_persistsChanges() throws Exception {
        MvcResult reg = register("profile2@test.local");
        String token = TestSupport.token(reg, "accessToken");

        mockMvc.perform(put("/api/v1/students/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Rahul Sharma",
                                  "mobile": "9000000000",
                                  "college": "ABC Engineering College",
                                  "degree": "BTech",
                                  "branch": "Computer Science",
                                  "graduationYear": 2027,
                                  "semester": 5,
                                  "location": "Hyderabad",
                                  "linkedinUrl": "https://linkedin.com/in/rahul"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fullName").value("Rahul Sharma"))
                .andExpect(jsonPath("$.data.college").value("ABC Engineering College"))
                .andExpect(jsonPath("$.data.graduationYear").value(2027));

        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.branch").value("Computer Science"))
                .andExpect(jsonPath("$.data.linkedinUrl").value("https://linkedin.com/in/rahul"));
    }

    @Test
    @DisplayName("Invalid profile fields return 400")
    void updateProfile_invalidSemester_validationFails() throws Exception {        MvcResult reg = register("profile3@test.local");
        String token = TestSupport.token(reg, "accessToken");

        mockMvc.perform(put("/api/v1/students/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Rahul",
                                  "semester": 99,
                                  "graduationYear": 1500
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("Profile update without semester succeeds (Sprint 8: optional field)")
    void updateProfile_nullSemester_succeeds() throws Exception {
        MvcResult reg = register("profile4@test.local");
        String token = TestSupport.token(reg, "accessToken");

        mockMvc.perform(put("/api/v1/students/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "No Semester",
                                  "college": "ABC Engineering College"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fullName").value("No Semester"));

        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.college").value("ABC Engineering College"));
    }

    private MvcResult register(String email) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Student %s",
                                  "email": "%s",
                                  "mobile": "9876543210",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email, email)))
                .andExpect(status().isCreated())
                .andReturn();
    }
}
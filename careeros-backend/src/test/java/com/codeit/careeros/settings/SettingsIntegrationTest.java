package com.codeit.careeros.settings;

import com.codeit.careeros.TestSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SettingsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @org.junit.jupiter.api.BeforeEach
    void clearSecurityContext() {
        // Defensive: never inherit a leaked authentication from another test class.
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Settings snapshot returns account, profile and honest notification state")
    void settings_snapshot() throws Exception {
        String token = registerStudent("settings-snap@test.local");
        mockMvc.perform(get("/api/v1/settings/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.account.email").value("settings-snap@test.local"))
                .andExpect(jsonPath("$.data.profile").exists())
                .andExpect(jsonPath("$.data.notificationsConnected").value(false))
                .andExpect(jsonPath("$.data.activeSessions").exists());

        mockMvc.perform(get("/api/v1/settings/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Password change works; wrong current password fails; new password logs in")
    void passwordChange_flow() throws Exception {
        String email = "settings-pwd@test.local";
        registerStudent(email);

        String token = login(email, "Password1");

        mockMvc.perform(put("/api/v1/users/me/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "WrongPass1", "newPassword": "NewPassword1"}
                                """))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(put("/api/v1/users/me/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "Password1", "newPassword": "NewPassword1"}
                                """))
                .andExpect(status().isOk());

        login(email, "NewPassword1");

        mockMvc.perform(put("/api/v1/users/me/password"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Session revocation and AI history clearing are owner-scoped")
    void sessionsAndAiHistory() throws Exception {
        String token = registerStudent("settings-sess@test.local");
        mockMvc.perform(post("/api/v1/users/me/sessions/revoke-all")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.revokedSessions").exists());

        mockMvc.perform(delete("/api/v1/settings/me/ai-history")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deletedSessions").value(0));

        mockMvc.perform(delete("/api/v1/settings/me/ai-history"))
                .andExpect(status().isUnauthorized());
    }

    private String registerStudent(String email) throws Exception {
        MvcResult reg = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName": "Settings Student", "email": "%s", "mobile": "9876543219", "password": "Password1", "termsAccepted": true}
                                """.formatted(email)))
                .andExpect(status().isCreated()).andReturn();
        return TestSupport.token(reg, "accessToken");
    }

    private String login(String email, String password) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "%s", "password": "%s"}
                                """.formatted(email, password)))
                .andExpect(status().isOk()).andReturn();
        return TestSupport.token(res, "accessToken");
    }
}

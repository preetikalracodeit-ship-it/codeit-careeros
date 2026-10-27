package com.codeit.careeros.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.concurrent.atomic.AtomicInteger;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RegisterMobileValidationTest {

    @Autowired
    private MockMvc mockMvc;

    private static final AtomicInteger SEQ = new AtomicInteger();

    private String email() {
        return "mobileval" + SEQ.incrementAndGet() + "@test.local";
    }

    private String body(String email, String mobileFragment) {
        return """
                {
                  "fullName": "Mobile Check",
                  "email": "%s",
                  "mobile": %s,
                  "password": "Password1", "termsAccepted": true}
                """.formatted(email, mobileFragment);
    }

    @ParameterizedTest
    @ValueSource(strings = {"9876543210", "6123456789"})
    @DisplayName("Register accepts valid Indian mobile numbers")
    void register_validMobileNumbers_accepted(String mobile) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(email(), "\"" + mobile + "\"")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            // Invalid starting digits (must start with 6-9).
            "1234567890", "5234567890",
            // Too short / too long.
            "987654321", "98765432101",
            // Letters and special characters.
            "98a6543210", "98765-4321", "98765 4321", "+9198765432"
    })
    @DisplayName("Register rejects invalid mobile numbers with a mobile field error")
    void register_invalidMobileNumbers_rejected(String mobile) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(email(), "\"" + mobile + "\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'mobile')]").exists());
    }

    @Test
    @DisplayName("Register with empty mobile returns a mobile required error")
    void register_emptyMobile_rejected() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(email(), "\"\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'mobile')]").exists());
    }

    @Test
    @DisplayName("Register with missing mobile returns a mobile required error")
    void register_missingMobile_rejected() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Mobile Check",
                                  "email": "%s",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'mobile')]").exists());
    }
}

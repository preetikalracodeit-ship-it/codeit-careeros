package com.codeit.careeros.ai;

import com.codeit.careeros.TestSupport;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Without {@code AI_API_KEY} the assistant fails fast with 503 before any
 * persistence or model call, while history APIs keep working.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {"app.ai.provider=openai", "app.ai.api-key=", "app.ai.gemini-api-key=",
        "app.ai.offline-fallback-enabled=false"})
class AiChatNotConfiguredTest {

    @TestConfiguration
    static class UnusedStubConfig {

        @Bean
        @Primary
        ChatModel chatModel() {
            return Mockito.mock(ChatModel.class, Mockito.RETURNS_MOCKS);
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("Send without API key returns 503 AI_NOT_CONFIGURED")
    void send_withoutKey_serviceUnavailable() throws Exception {
        MvcResult registered = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "No Key Student",
                                  "email": "ainokey@test.local",
                                  "mobile": "9876543210",
                                  "password": "Password1", "termsAccepted": true}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        String token = TestSupport.token(registered, "accessToken");

        MvcResult created = mockMvc.perform(post("/api/v1/ai/chat/sessions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andReturn();
        long sessionId = objectMapper.readTree(created.getResponse().getContentAsString())
                .path("data").path("id").asLong();

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"Hello\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode").value("AI_NOT_CONFIGURED"));
    }
}

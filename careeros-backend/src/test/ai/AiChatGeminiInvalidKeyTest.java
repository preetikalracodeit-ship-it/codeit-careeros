package com.codeit.careeros.ai;

import com.codeit.careeros.TestSupport;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Gemini provider failure (e.g. invalid API key) with the offline fallback
 * disabled: the assistant returns 502 AI_ERROR with a useful, user-safe
 * message that never leaks the key or provider internals.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "app.ai.provider=gemini",
        "app.ai.offline-fallback-enabled=false"
})
class AiChatGeminiInvalidKeyTest {

    @TestConfiguration
    static class RejectedKeyConfig {

        @Bean
        @Primary
        ChatModel chatModel() {
            ChatModel stub = Mockito.mock(ChatModel.class);
            Mockito.when(stub.call(Mockito.any(Prompt.class))).thenThrow(
                    new RuntimeException("401 Unauthorized: invalid API key "
                            + "AIza-secret-leak-check https://generativelanguage.googleapis.com/internal"));
            return stub;
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("Invalid Gemini key gives 502 AI_ERROR without leaking secrets")
    void invalidKey_usefulProviderError() throws Exception {
        MvcResult registered = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Bad Gemini Key Student",
                                  "email": "geminibadkey@test.local",
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

        MvcResult result = mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is Java?\"}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.errorCode").value("AI_ERROR"))
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("AIza-secret-leak-check");
        assertThat(body).doesNotContain("generativelanguage.googleapis.com/internal");
        assertThat(body).containsIgnoringCase("credential");
    }
}

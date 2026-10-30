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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * When an LLM IS configured but the provider fails/times out, the assistant
 * falls back to offline Smart Guidance (HTTP 200) instead of 502 — the chat
 * never goes silent.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "app.ai.offline-fallback-enabled=true")
class AiChatProviderFallbackTest {

    @TestConfiguration
    static class BrokenProviderConfig {
        @Bean
        @Primary
        ChatModel chatModel() {
            ChatModel stub = Mockito.mock(ChatModel.class);
            Mockito.when(stub.call(Mockito.any(Prompt.class)))
                    .thenThrow(new RuntimeException("401 Unauthorized key=sk-secret https://internal.local"));
            return stub;
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("Provider failure falls back to offline answer without leaking secrets")
    void providerFailure_fallsBack() throws Exception {
        MvcResult registered = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Fallback Student",
                                  "email": "fallback@test.local",
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
                        .content("{\"message\":\"What should I learn next?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").isNotEmpty())
                .andExpect(jsonPath("$.data.offline").value(true))
                .andReturn();

        String body = result.getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(body).doesNotContain("sk-secret");
        org.assertj.core.api.Assertions.assertThat(body).doesNotContain("internal.local");
    }

    @Test
    @DisplayName("Provider failure on a curated general question still answers offline")
    void providerFailure_generalQuestionUnavailable() throws Exception {
        MvcResult registered = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "General Fallback Student",
                                  "email": "fallback-general@test.local",
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
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.offline").value(true))
                .andExpect(jsonPath("$.data.toolsUsed.length()").value(0))
                .andReturn();

        String reply = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("reply").asText();
        org.assertj.core.api.Assertions.assertThat(reply).contains("Java — explained");
    }

    @Test
    @DisplayName("Provider failure on an uncurated general question stays honest")
    void providerFailure_uncuratedGeneralQuestionHonest() throws Exception {
        MvcResult registered = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Honest Fallback Student",
                                  "email": "fallback-honest@test.local",
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
                        .content("{\"message\":\"What is the capital of France?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.offline").value(true))
                .andReturn();

        String reply = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("reply").asText();
        org.assertj.core.api.Assertions.assertThat(reply).containsIgnoringCase("trouble reaching");
    }
}

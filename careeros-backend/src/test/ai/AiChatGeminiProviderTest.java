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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Gemini provider integration tests. The selected {@link ChatModel} (a real
 * {@code GoogleGenAiChatModel} in production via {@code AI_PROVIDER=gemini})
 * is replaced with a scripted stub, so general questions, personalized
 * CareerOS questions, mixed questions, tool calling, ownership, history and
 * role guards are verified with no network and no API key.
 *
 * <p>Nothing about the chat flow changes between providers: the same
 * {@link CareerAssistantService} loop, tools, history, fallback and security
 * apply — only the underlying model bean differs.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "app.ai.provider=gemini")
class AiChatGeminiProviderTest {

    @TestConfiguration
    static class GeminiStubConfig {

        @Bean
        @Primary
        ChatModel chatModel() {
            ChatModel stub = Mockito.mock(ChatModel.class);
            Mockito.when(stub.call(Mockito.any(Prompt.class))).thenAnswer(invocation -> {
                Prompt prompt = invocation.getArgument(0);
                if (StubToolModels.hasToolResponses(prompt)) {
                    return StubToolModels.textAnswer("Gemini says: your readiness is 42% "
                            + "and Java is your top gap.");
                }
                String lastUser = StubToolModels.lastUserText(prompt);
                if (lastUser.contains("DROP TABLE")) {
                    return StubToolModels.toolCall("dropTables", "{}");
                }
                if (isPersonalAsk(lastUser)) {
                    return StubToolModels.toolCall("getReadiness", "{}");
                }
                return StubToolModels.textAnswer("Gemini says: Java is a general-purpose, "
                        + "object-oriented language running on the JVM.");
            });
            return stub;
        }

        private static boolean isPersonalAsk(String text) {
            String lower = text.toLowerCase();
            return lower.contains("my ") || lower.contains(" mine")
                    || lower.contains("how ready") || lower.contains("skill gap")
                    || lower.contains("how good");
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String registerStudent(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Gemini Student",
                                  "email": "%s",
                                  "mobile": "9876543210",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return TestSupport.token(result, "accessToken");
    }

    private long createSession(String token) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/ai/chat/sessions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(created.getResponse().getContentAsString())
                .path("data").path("id").asLong();
    }

    private MvcResult send(String token, long sessionId, String message) throws Exception {
        return mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"%s\"}".formatted(message.replace("\"", "'"))))
                .andExpect(status().isOk())
                .andReturn();
    }

    @Test
    @DisplayName("General question is answered directly with no CareerOS tools")
    void generalQuestion_answeredWithoutTools() throws Exception {
        String token = registerStudent("gemini1@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is Java?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").value("Gemini says: Java is a general-purpose, "
                        + "object-oriented language running on the JVM."))
                .andExpect(jsonPath("$.data.toolsUsed.length()").value(0))
                .andExpect(jsonPath("$.data.offline").value(false))
                .andExpect(jsonPath("$.data.mode").value("llm"));
    }

    @Test
    @DisplayName("Personal CareerOS question uses real tool results")
    void personalQuestion_usesTools() throws Exception {
        String token = registerStudent("gemini2@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"How ready am I?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").isNotEmpty())
                .andExpect(jsonPath("$.data.toolsUsed[0]").value("getReadiness"))
                .andExpect(jsonPath("$.data.mode").value("llm"));

        // Personal turn is persisted in history with both roles.
        mockMvc.perform(get("/api/v1/ai/chat/sessions/" + sessionId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[1].role").value("ASSISTANT"));
    }

    @Test
    @DisplayName("Mixed question combines general knowledge with personal data")
    void mixedQuestion_generalPlusPersonal() throws Exception {
        String token = registerStudent("gemini3@test.local");
        long sessionId = createSession(token);

        MvcResult result = send(token, sessionId,
                "Explain Spring Boot and tell me how good I am at it");
        String reply = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("reply").asText();
        assertThat(reply).isNotEmpty();
        assertThat(objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("toolsUsed").toString()).contains("getReadiness");
    }

    @Test
    @DisplayName("Follow-up keeps conversation context in the same session")
    void followUp_keepsHistory() throws Exception {
        String token = registerStudent("gemini4@test.local");
        long sessionId = createSession(token);

        send(token, sessionId, "What is Spring Boot");
        send(token, sessionId, "How good am I at it");

        mockMvc.perform(get("/api/v1/ai/chat/sessions/" + sessionId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(4))
                .andExpect(jsonPath("$.data[0].role").value("USER"))
                .andExpect(jsonPath("$.data[3].role").value("ASSISTANT"));
    }

    @Test
    @DisplayName("Unknown tool is rejected, never recorded, model still answers")
    void unknownTool_rejectedAndAnswered() throws Exception {
        String token = registerStudent("gemini5@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"DROP TABLE users\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").isNotEmpty())
                .andExpect(jsonPath("$.data.toolsUsed.length()").value(0));
    }

    @Test
    @DisplayName("Second student cannot access another student's Gemini session")
    void crossStudentAccess_notFound() throws Exception {
        String owner = registerStudent("gemini6@test.local");
        String intruder = registerStudent("gemini7@test.local");
        long sessionId = createSession(owner);

        mockMvc.perform(get("/api/v1/ai/chat/sessions/" + sessionId)
                        .header("Authorization", "Bearer " + intruder))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("NOT_FOUND"));

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + intruder)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"Hi\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/v1/ai/chat/sessions/" + sessionId)
                        .header("Authorization", "Bearer " + intruder))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Anonymous user cannot access Gemini AI endpoints")
    void anonymous_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/ai/chat/sessions"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/ai/status"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Status reports gemini provider without exposing secrets")
    void status_geminiNoSecrets() throws Exception {
        String token = registerStudent("gemini8@test.local");
        MvcResult result = mockMvc.perform(get("/api/v1/ai/status")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configured").value(true))
                .andExpect(jsonPath("$.data.provider").value("gemini"))
                .andExpect(jsonPath("$.data.model").isNotEmpty())
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("test-key");
    }
}

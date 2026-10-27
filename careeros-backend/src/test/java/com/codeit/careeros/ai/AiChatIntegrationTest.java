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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sprint 7 AI assistant integration tests. The Spring AI {@link ChatModel} is
 * replaced with a scripted stub, so the full flow — sessions, history,
 * controlled tool loop, ownership, role guards — is verified with no network
 * and no API key.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AiChatIntegrationTest {

    @TestConfiguration
    static class StubChatModelConfig {

        @Bean
        @Primary
        ChatModel chatModel() {
            ChatModel stub = Mockito.mock(ChatModel.class);
            Mockito.when(stub.call(Mockito.any(Prompt.class))).thenAnswer(invocation -> {
                Prompt prompt = invocation.getArgument(0);
                String lastUser = StubToolModels.lastUserText(prompt);
                if (lastUser.contains("weakest skills")) {
                    // Multi-step reasoning: gaps first, then projects, then answer.
                    long rounds = StubToolModels.countToolResponses(prompt);
                    if (rounds == 0) {
                        return StubToolModels.toolCall("getSkillGaps", "{\"topN\":5}");
                    }
                    if (rounds == 1) {
                        return StubToolModels.toolCall("getProjects", "{}");
                    }
                    return StubToolModels.textAnswer(
                            "Stubbed multi-step guidance based on your gaps and projects.");
                }
                if (StubToolModels.hasToolResponses(prompt)) {
                    return StubToolModels.textAnswer(
                            "Stubbed guidance based on your CareerOS tools.");
                }
                if (lastUser.contains("DROP TABLE")) {
                    return StubToolModels.toolCall("dropTables", "{}");
                }
                if (lastUser.equals("What is Java?")) {
                    // General knowledge: the model answers directly, no tools.
                    return StubToolModels.textAnswer(
                            "Java is a high-level, object-oriented programming language.");
                }
                return StubToolModels.toolCall("getReadiness", "{}");
            });
            return stub;
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
                                  "fullName": "AI Student",
                                  "email": "%s",
                                  "mobile": "9876543210",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return TestSupport.token(result, "accessToken");
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

    private long createSession(String token) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/ai/chat/sessions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isNumber())
                .andReturn();
        return objectMapper.readTree(created.getResponse().getContentAsString())
                .path("data").path("id").asLong();
    }

    @Test
    @DisplayName("Full chat turn: tool loop runs, reply persisted with history")
    void chatTurn_usesToolsAndPersistsHistory() throws Exception {
        String token = registerStudent("ai1@test.local");
        long sessionId = createSession(token);

        MvcResult reply = mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What skills am I missing?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").value("Stubbed guidance based on your CareerOS tools."))
                .andExpect(jsonPath("$.data.toolsUsed[0]").value("getReadiness"))
                .andReturn();
        assertThat(reply.getResponse().getContentAsString()).contains("toolsUsed");

        mockMvc.perform(get("/api/v1/ai/chat/sessions/" + sessionId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].role").value("USER"))
                .andExpect(jsonPath("$.data[0].content").value("What skills am I missing?"))
                .andExpect(jsonPath("$.data[1].role").value("ASSISTANT"));

        mockMvc.perform(get("/api/v1/ai/chat/sessions")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    @DisplayName("Unknown tool is rejected, never recorded, and the model still answers")
    void unknownTool_rejectedAndAnswered() throws Exception {
        String token = registerStudent("ai2@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"DROP TABLE users\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").value("Stubbed guidance based on your CareerOS tools."))
                .andExpect(jsonPath("$.data.toolsUsed.length()").value(0));
    }

    @Test
    @DisplayName("Multi-step reasoning chains skill gaps then projects before answering")
    void multiStep_chainsToolsInOrder() throws Exception {
        String token = registerStudent("ai7@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What project should I build to improve my weakest skills?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply")
                        .value("Stubbed multi-step guidance based on your gaps and projects."))
                .andExpect(jsonPath("$.data.toolsUsed[0]").value("getSkillGaps"))
                .andExpect(jsonPath("$.data.toolsUsed[1]").value("getProjects"))
                .andExpect(jsonPath("$.data.toolsUsed.length()").value(2));
    }

    @Test
    @DisplayName("General question is answered directly by the model with no tools")
    void generalQuestion_noToolsCalled() throws Exception {
        String token = registerStudent("ai8@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is Java?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply")
                        .value("Java is a high-level, object-oriented programming language."))
                .andExpect(jsonPath("$.data.toolsUsed.length()").value(0))
                .andExpect(jsonPath("$.data.mode").value("llm"));
    }

    @Test
    @DisplayName("Second student cannot see, write, or delete another student's session")
    void crossStudentAccess_notFound() throws Exception {
        String owner = registerStudent("ai3@test.local");
        String intruder = registerStudent("ai4@test.local");
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

        mockMvc.perform(get("/api/v1/ai/chat/sessions")
                        .header("Authorization", "Bearer " + intruder))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    @DisplayName("New conversation keeps a separate history")
    void newConversation_separateHistory() throws Exception {
        String token = registerStudent("ai5@test.local");
        long first = createSession(token);
        long second = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + first + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"First chat\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/ai/chat/sessions/" + second)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    @DisplayName("Admin cannot use student AI endpoints")
    void admin_forbidden() throws Exception {
        String token = adminToken();
        mockMvc.perform(get("/api/v1/ai/chat/sessions")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Unauthenticated AI requests are rejected")
    void anonymous_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/ai/chat/sessions"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/ai/status"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Status endpoint reports the configured test provider without secrets")
    void status_noSecrets() throws Exception {
        String token = registerStudent("ai6@test.local");
        MvcResult result = mockMvc.perform(get("/api/v1/ai/status")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configured").value(true))
                .andExpect(jsonPath("$.data.provider").isNotEmpty())
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("test-key");
    }
}

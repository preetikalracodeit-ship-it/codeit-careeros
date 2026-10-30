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

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestPropertySource(properties = {
        "app.ai.max-tool-iterations=2",
        "app.ai.request-timeout-seconds=3",
        "app.ai.rate-limit-per-minute=100",
        "app.ai.offline-fallback-enabled=false"
})
class AiChatReliabilityTest {

    static final AtomicInteger MODE = new AtomicInteger(0);

    @TestConfiguration
    static class Config {
        @Bean
        @Primary
        ChatModel chatModel() {
            ChatModel stub = Mockito.mock(ChatModel.class);
            Mockito.when(stub.call(Mockito.any(Prompt.class))).thenAnswer(inv -> {
                int mode = MODE.get();
                if (mode == 1) {
                    return StubToolModels.toolCall("getReadiness", "{}");
                }
                if (mode == 2) {
                    throw new RuntimeException("401 Unauthorized key=sk-secret https://internal.local");
                }
                if (mode == 3) {
                    Thread.sleep(8000);
                    return StubToolModels.textAnswer("too late");
                }
                return StubToolModels.textAnswer("ok reply");
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
                        .content("{\"fullName\":\"Rel Student\",\"email\":\"" + email
                                + "\",\"mobile\":\"9876543210\",\"password\":\"Password1\",\"termsAccepted\":true}"))
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

    @Test
    @Order(2)
    @DisplayName("Blank and oversized messages are rejected with 400")
    void validation_rejected() throws Exception {
        MODE.set(0);
        String token = registerStudent("rel1@test.local");
        long sessionId = createSession(token);
        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"   \"}"))
                .andExpect(status().isBadRequest());
        String big = "x".repeat(4001);
        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("message", big))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Order(3)
    @DisplayName("Tool-only model stops after max iterations with fallback")
    void maxIterations_fallback() throws Exception {
        MODE.set(1);
        try {
            String token = registerStudent("rel3@test.local");
            long sessionId = createSession(token);
            mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"message\":\"What should I improve?\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.reply").value(
                            org.hamcrest.Matchers.containsString("ran out of steps")));
        } finally {
            MODE.set(0);
        }
    }

    @Test
    @Order(4)
    @DisplayName("Provider error mapped to 502 without leaking secrets")
    void providerError_sanitized() throws Exception {
        MODE.set(2);
        try {
            String token = registerStudent("rel4@test.local");
            long sessionId = createSession(token);
            MvcResult result = mockMvc.perform(
                            post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"message\":\"Hello\"}"))
                    .andExpect(status().isBadGateway())
                    .andExpect(jsonPath("$.errorCode").value("AI_ERROR"))
                    .andReturn();
            String body = result.getResponse().getContentAsString();
            assertThat(body).doesNotContain("sk-secret");
            assertThat(body).doesNotContain("internal.local");
        } finally {
            MODE.set(0);
        }
    }

    @Test
    @Order(1)
    @DisplayName("Slow provider hits timeout budget and returns 502")
    void providerTimeout_badGateway() throws Exception {
        MODE.set(3);
        try {
            String token = registerStudent("rel5@test.local");
            long sessionId = createSession(token);
            mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"message\":\"Hello, are you there?\"}"))
                    .andExpect(status().isBadGateway())
                    .andExpect(jsonPath("$.errorCode").value("AI_ERROR"));
        } finally {
            MODE.set(0);
        }
    }
}


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

import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bounded retry for transient Gemini/provider failures.
 *
 * <p>A single chat turn retries at most {@code app.ai.max-retries} times with
 * exponential backoff, and only for transient signals (HTTP 429/503/500/502/504,
 * overload, timeouts). Auth/model errors (401/403/404) fail fast with no retry.
 * General questions ("What is React?", "What is HTML?") are answered directly
 * by the model with no CareerOS tools, even with no target career selected.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "app.ai.provider=gemini",
        "app.ai.max-tool-iterations=2",
        "app.ai.request-timeout-seconds=5",
        "app.ai.rate-limit-per-minute=100",
        "app.ai.max-retries=2",
        "app.ai.retry-backoff-millis=10",
        "app.ai.offline-fallback-enabled=false"
})
class AiChatRetryTest {

    /** Scripted outcomes: ChatResponse-like text or RuntimeException to throw. */
    static final Queue<Object> SCRIPT = new ConcurrentLinkedQueue<>();
    static final AtomicInteger CALLS = new AtomicInteger(0);

    @TestConfiguration
    static class RetryStubConfig {
        @Bean
        @Primary
        ChatModel chatModel() {
            ChatModel stub = Mockito.mock(ChatModel.class);
            Mockito.when(stub.call(Mockito.any(Prompt.class))).thenAnswer(inv -> {
                CALLS.incrementAndGet();
                Object next = SCRIPT.poll();
                if (next == null) {
                    return StubToolModels.textAnswer("ok reply");
                }
                if (next instanceof RuntimeException ex) {
                    throw ex;
                }
                return StubToolModels.textAnswer(String.valueOf(next));
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
                        .content("{\"fullName\":\"Retry Student\",\"email\":\"" + email
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
    @DisplayName("Transient 503 is retried once and then succeeds via LLM")
    void transient503_retriedThenSucceeds() throws Exception {
        SCRIPT.clear();
        CALLS.set(0);
        SCRIPT.add(new RuntimeException("503 Service Unavailable: model overloaded, please try again"));
        SCRIPT.add("Gemini recovered answer");

        String token = registerStudent("retry503@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is React?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").value("Gemini recovered answer"))
                .andExpect(jsonPath("$.data.mode").value("llm"))
                .andExpect(jsonPath("$.data.offline").value(false))
                .andExpect(jsonPath("$.data.toolsUsed.length()").value(0));

        assertThat(CALLS.get()).isEqualTo(2);
    }

    @Test
    @DisplayName("Transient 429 rate-limit is retried and then succeeds")
    void transient429_retriedThenSucceeds() throws Exception {
        SCRIPT.clear();
        CALLS.set(0);
        SCRIPT.add(new RuntimeException("429 RESOURCE_EXHAUSTED: quota exceeded, retry in 5s"));
        SCRIPT.add("Recovered after rate limit");

        String token = registerStudent("retry429@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is HTML?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").value("Recovered after rate limit"))
                .andExpect(jsonPath("$.data.mode").value("llm"));

        assertThat(CALLS.get()).isEqualTo(2);
    }

    @Test
    @DisplayName("Persistent 503 gives 502 after bounded attempts without leaking secrets")
    void persistent503_boundedAttemptsNoLeak() throws Exception {
        SCRIPT.clear();
        CALLS.set(0);
        String secret = "AIza-secret-retry-leak-check";
        for (int i = 0; i < 5; i++) {
            SCRIPT.add(new RuntimeException("503 UNAVAILABLE overloaded key=" + secret
                    + " https://generativelanguage.googleapis.com/internal"));
        }

        String token = registerStudent("retry503persist@test.local");
        long sessionId = createSession(token);

        MvcResult result = mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is React?\"}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.errorCode").value("AI_ERROR"))
                .andReturn();

        // max-retries=2 -> exactly 3 provider calls, never indefinite.
        assertThat(CALLS.get()).isEqualTo(3);
        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain(secret);
        assertThat(body).doesNotContain("generativelanguage.googleapis.com/internal");
    }

    @Test
    @DisplayName("Invalid credentials (401) are NOT retried")
    void invalidKey_noRetry() throws Exception {
        SCRIPT.clear();
        CALLS.set(0);
        SCRIPT.add(new RuntimeException("401 Unauthorized: invalid API key AIza-secret-no-retry"));
        SCRIPT.add("should never be reached");

        String token = registerStudent("retrynoretry@test.local");
        long sessionId = createSession(token);

        MvcResult result = mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is Java?\"}"))
                .andExpect(status().isBadGateway())
                .andReturn();

        assertThat(CALLS.get()).isEqualTo(1);
        assertThat(result.getResponse().getContentAsString()).doesNotContain("AIza-secret-no-retry");
    }

    @Test
    @DisplayName("Unknown model (404) is NOT retried")
    void unknownModel_noRetry() throws Exception {
        SCRIPT.clear();
        CALLS.set(0);
        SCRIPT.add(new RuntimeException("404 models/gemini-9.9-flash is not found for API version v1beta"));
        SCRIPT.add("should never be reached");

        String token = registerStudent("retrymodel404@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is Java?\"}"))
                .andExpect(status().isBadGateway());

        assertThat(CALLS.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("General 'What is React?' answered directly with no tools and no target career")
    void generalReact_answeredWithoutTools() throws Exception {
        SCRIPT.clear();
        CALLS.set(0);
        SCRIPT.add("React is a JavaScript library for building user interfaces.");

        String token = registerStudent("retryreact@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is React?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").value("React is a JavaScript library for building user interfaces."))
                .andExpect(jsonPath("$.data.toolsUsed.length()").value(0))
                .andExpect(jsonPath("$.data.offline").value(false))
                .andExpect(jsonPath("$.data.mode").value("llm"));
    }

    @Test
    @DisplayName("General 'What is HTML?' answered directly with no tools and no target career")
    void generalHtml_answeredWithoutTools() throws Exception {
        SCRIPT.clear();
        CALLS.set(0);
        SCRIPT.add("HTML is the standard markup language for web pages.");

        String token = registerStudent("retryhtml@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is HTML?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").value("HTML is the standard markup language for web pages."))
                .andExpect(jsonPath("$.data.toolsUsed.length()").value(0))
                .andExpect(jsonPath("$.data.offline").value(false))
                .andExpect(jsonPath("$.data.mode").value("llm"));
    }

    @Test
    @DisplayName("General 'Explain Java' answered directly with no tools")
    void generalJava_answeredWithoutTools() throws Exception {
        SCRIPT.clear();
        CALLS.set(0);
        SCRIPT.add("Java is a general-purpose object-oriented language running on the JVM.");

        String token = registerStudent("retryjava@test.local");
        long sessionId = createSession(token);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"Explain Java\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reply").value("Java is a general-purpose object-oriented language running on the JVM."))
                .andExpect(jsonPath("$.data.toolsUsed.length()").value(0))
                .andExpect(jsonPath("$.data.mode").value("llm"));
    }
}

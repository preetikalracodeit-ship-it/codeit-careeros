package com.codeit.careeros.ai;

import com.codeit.careeros.TestSupport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
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

import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end verification of the general + CareerOS-personal assistant
 * contract. The stub below mimics a REAL general-purpose LLM following the
 * system prompt: general knowledge answered directly (no tools), personal
 * asks via CareerOS tools, mixed via both. All traffic goes through the REAL
 * HTTP endpoint + REAL tool loop + REAL persistence.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MandatoryQuestionsVerificationTest {

    @TestConfiguration
    static class GeneralPurposeLlmStub {
        @Bean
        @Primary
        ChatModel chatModel() {
            ChatModel stub = Mockito.mock(ChatModel.class);
            Mockito.when(stub.call(Mockito.any(Prompt.class))).thenAnswer(invocation -> {
                Prompt prompt = invocation.getArgument(0);
                String lastUser = StubToolModels.lastUserText(prompt).toLowerCase(Locale.ROOT);
                long rounds = StubToolModels.countToolResponses(prompt);
                if (rounds > 0) {
                    // After tool results, compose the final natural answer.
                    if (lastUser.contains("spring boot") && lastUser.contains("how good am i")) {
                        return text("Spring Boot is an opinionated Java framework for "
                                + "production-ready REST APIs. Based on your CareerOS tools, "
                                + "here is your measured standing and next step.");
                    }
                    if (lastUser.contains("which ones am i missing")
                            || lastUser.contains("which ones are missing")) {
                        return text("To become a Java developer you generally need Java OOP, "
                                + "Collections, SQL, Spring Boot and Git. Compared against "
                                + "your CareerOS tools, here are the ones you are missing.");
                    }
                    return text("Here is your answer grounded in your CareerOS data.");
                }
                // Mixed two-part asks need a tool first.
                if (lastUser.contains("how good am i at")) {
                    return StubToolModels.toolCall("getSkillGaps", "{\"topN\":5}");
                }
                if (lastUser.contains("which ones am i missing")
                        || lastUser.contains("which ones are missing")) {
                    return StubToolModels.toolCall("getSkillGaps", "{\"topN\":8}");
                }
                // Purely personal asks need tools.
                if (lastUser.contains("java score") || lastUser.contains("my score")) {
                    return StubToolModels.toolCall("getAssessmentHistory", "{}");
                }
                if (lastUser.contains("readiness") || lastUser.contains("how ready")) {
                    return StubToolModels.toolCall("getReadiness", "{}");
                }
                if (lastUser.contains("skill gap") || lastUser.contains("skill gaps")) {
                    return StubToolModels.toolCall("getSkillGaps", "{\"topN\":5}");
                }
                if (lastUser.contains("learn next")) {
                    return StubToolModels.toolCall("getRoadmap", "{}");
                }
                // Everything else is general knowledge: answer directly, no tools.
                if (lastUser.contains("reverse")) {
                    return text("Use new StringBuilder(s).reverse().toString() — "
                            + "and know the manual loop version for interviews.");
                }
                if (lastUser.contains("interview")) {
                    return text("Java interview questions: OOP pillars, == vs equals, "
                            + "JDK vs JRE vs JVM, HashMap internals, Streams, exceptions.");
                }
                if (lastUser.contains("skills are required to become")) {
                    return text("To become a Java developer: Java OOP, Collections, "
                            + "Exception handling, SQL, Spring Boot, Git, JUnit and DSA basics.");
                }
                if (lastUser.contains("spring boot") && lastUser.contains("explain")) {
                    return text("Spring Boot is an opinionated Java framework that makes it "
                            + "easy to build production-ready REST APIs with minimal setup.");
                }
                if (lastUser.contains("why is it useful")) {
                    return text("It is useful because auto-configuration and the embedded "
                            + "server remove boilerplate so you can ship a REST API fast.");
                }
                if (lastUser.contains("java") && !lastUser.contains("javascript")) {
                    return text("Java is a high-level, object-oriented programming language "
                            + "running on the JVM: write once, run anywhere.");
                }
                if (lastUser.contains("react")) {
                    return text("React is a JavaScript library for building user interfaces "
                            + "with components, props and state.");
                }
                if (lastUser.contains("sql")) {
                    return text("SQL is the standard language for querying relational "
                            + "databases: SELECT, JOIN, GROUP BY and transactions.");
                }
                if (lastUser.contains("polymorphism")) {
                    return text("Polymorphism lets one interface take many forms: "
                            + "compile-time overloading and runtime overriding.");
                }
                return text("Here is a direct general answer with no CareerOS data needed.");
            });
            return stub;
        }

        private static ChatResponse text(String s) {
            return new ChatResponse(
                    List.of(new Generation(AssistantMessage.builder().content(s).build())));
        }
    }

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    private String token(String email) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Verify Student","email":"%s",
                                 "mobile":"9876543210","password":"Password1","termsAccepted":true}""".formatted(email)))
                .andExpect(status().isCreated()).andReturn();
        return TestSupport.token(r, "accessToken");
    }

    private long session(String token) throws Exception {
        MvcResult c = mockMvc.perform(post("/api/v1/ai/chat/sessions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(c.getResponse().getContentAsString())
                .path("data").path("id").asLong();
    }

    private JsonNode ask(String token, long sessionId, String message) throws Exception {
        MvcResult r = mockMvc.perform(post(
                                "/api/v1/ai/chat/sessions/" + sessionId + "/messages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                java.util.Map.of("message", message))))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).path("data");
    }

    private void assertGeneral(JsonNode data, String... absent) {
        assertThat(data.path("reply").asText()).isNotEmpty();
        assertThat(data.path("toolsUsed").size()).isEqualTo(0);
        assertThat(data.path("mode").asText()).isEqualTo("llm");
        for (String s : absent) {
            assertThat(data.path("reply").asText()).doesNotContain(s);
        }
    }

    private void assertPersonal(JsonNode data, String expectedTool) {
        assertThat(data.path("reply").asText()).isNotEmpty();
        assertThat(data.path("mode").asText()).isEqualTo("llm");
        List<String> tools = new java.util.ArrayList<>();
        data.path("toolsUsed").forEach(t -> tools.add(t.asText()));
        assertThat(tools).contains(expectedTool);
    }

    @Test
    @DisplayName("Mandatory 1-8: general questions get LLM answers with zero tools")
    void generalQuestions_llmAnswersNoTools() throws Exception {
        String t = token("verify-general@test.local");
        long s = session(t);
        assertGeneral(ask(t, s, "What is Java?"), "readiness", "Readiness");
        assertGeneral(ask(t, s, "Explain Spring Boot."));
        assertGeneral(ask(t, s, "What is React?"));
        assertGeneral(ask(t, s, "What is SQL?"));
        assertGeneral(ask(t, s, "Explain polymorphism."));
        assertGeneral(ask(t, s, "Write a Java program to reverse a string."));
        assertGeneral(ask(t, s, "Give me Java interview questions."));
        JsonNode roleSkills = ask(t, s, "What skills are required to become a Java developer?");
        assertGeneral(roleSkills);
        assertThat(roleSkills.path("reply").asText()).containsIgnoringCase("Java");
    }

    @Test
    @DisplayName("Mandatory 9-11+14: personal questions use CareerOS tools")
    void personalQuestions_useTools() throws Exception {
        String t = token("verify-personal@test.local");
        long s = session(t);
        assertPersonal(ask(t, s, "What is my Java score?"), "getAssessmentHistory");
        assertPersonal(ask(t, s, "What is my career readiness?"), "getReadiness");
        assertPersonal(ask(t, s, "What are my skill gaps?"), "getSkillGaps");
        assertPersonal(ask(t, s, "What should I learn next?"), "getRoadmap");
    }

    @Test
    @DisplayName("Mandatory 12-13: mixed questions combine LLM explanation with tool data")
    void mixedQuestions_llmPlusTools() throws Exception {
        String t = token("verify-mixed@test.local");
        long s = session(t);
        JsonNode mixed = ask(t, s, "What is Spring Boot and how good am I at it?");
        assertThat(mixed.path("reply").asText()).contains("Spring Boot");
        List<String> tools = new java.util.ArrayList<>();
        mixed.path("toolsUsed").forEach(x -> tools.add(x.asText()));
        assertThat(tools).contains("getSkillGaps");
        assertThat(mixed.path("mode").asText()).isEqualTo("llm");

        JsonNode combo = ask(t, s,
                "What skills do I need for Java development and which ones am I missing?");
        assertThat(combo.path("reply").asText().toLowerCase(Locale.ROOT))
                .contains("missing");
        List<String> tools2 = new java.util.ArrayList<>();
        combo.path("toolsUsed").forEach(x -> tools2.add(x.asText()));
        assertThat(tools2).contains("getSkillGaps");
    }

    @Test
    @DisplayName("Mandatory 15: multi-turn context resolves follow-ups incl. personal 'it'")
    void multiTurn_contextPreserved() throws Exception {
        String t = token("verify-context@test.local");
        long s = session(t);
        JsonNode first = ask(t, s, "What is Spring Boot?");
        assertThat(first.path("toolsUsed").size()).isEqualTo(0);
        JsonNode follow = ask(t, s, "Why is it useful?");
        assertThat(follow.path("reply").asText()).containsIgnoringCase("useful");
        assertThat(follow.path("toolsUsed").size()).isEqualTo(0);
        JsonNode personal = ask(t, s, "How good am I at it?");
        List<String> tools = new java.util.ArrayList<>();
        personal.path("toolsUsed").forEach(x -> tools.add(x.asText()));
        assertThat(tools).contains("getSkillGaps");
        assertThat(personal.path("mode").asText()).isEqualTo("llm");
    }
}

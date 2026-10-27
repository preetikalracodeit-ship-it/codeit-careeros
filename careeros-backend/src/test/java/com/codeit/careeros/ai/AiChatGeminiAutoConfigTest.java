package com.codeit.careeros.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies Gemini provider wiring end to end WITHOUT stubbing the model: with
 * {@code app.ai.provider=gemini} the context boots with both provider models
 * available and the resolver selects the real Spring AI Google GenAI model.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "app.ai.provider=gemini",
        "app.ai.model=gpt-4o-mini",
        "app.ai.api-key=test-key-for-stubbed-chat-model",
        "app.ai.gemini-api-key=",
        "app.ai.gemini-model="
})
class AiChatGeminiAutoConfigTest {

    @Autowired
    private AiChatModelResolver chatModels;

    @Autowired
    private AiProperties aiProperties;

    @Autowired
    private org.springframework.context.ApplicationContext context;

    @Test
    @DisplayName("Both provider models boot, resolver selects the Google model for gemini")
    void gemini_resolvesGoogleModel() {
        String[] names = context.getBeanNamesForType(ChatModel.class);
        assertThat(names).contains(
                AiChatModelResolver.OPENAI_BEAN, AiChatModelResolver.GEMINI_BEAN);

        ChatModel active = chatModels.active();
        assertThat(active.getClass().getName())
                .isEqualTo("org.springframework.ai.google.genai.GoogleGenAiChatModel");
        assertThat(chatModels.activeBeanName()).isEqualTo(AiChatModelResolver.GEMINI_BEAN);
    }

    @Test
    @DisplayName("Gemini effective key falls back to AI_API_KEY, model defaults to Gemini")
    void gemini_effectiveKeyAndModel() {
        assertThat(aiProperties.isGemini()).isTrue();
        // application-test.yml provides app.ai.api-key for the stubbed-model
        // tests; the Gemini provider reuses it when GEMINI_API_KEY is blank.
        assertThat(aiProperties.effectiveApiKey()).isEqualTo("test-key-for-stubbed-chat-model");
        assertThat(aiProperties.isConfigured()).isTrue();
        // application.yml uses gemini-2.5-flash (the GA default); 2.0-flash was
        // shut down on 2026-06-01 and must not be selected implicitly.
        assertThat(aiProperties.effectiveModel()).isEqualTo("gemini-2.5-flash");
    }
}

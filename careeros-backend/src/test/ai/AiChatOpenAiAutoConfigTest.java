package com.codeit.careeros.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the default (OpenAI-compatible) provider path still resolves to
 * the real Spring AI OpenAI model now that the Gemini starter coexists on the
 * classpath — i.e. adding Gemini did not break provider selection for
 * {@code AI_PROVIDER=openai} (the default) and, by extension, ollama/custom.
 */
@SpringBootTest
@ActiveProfiles("test")
class AiChatOpenAiAutoConfigTest {

    @Autowired
    private AiChatModelResolver chatModels;

    @Autowired
    private AiProperties aiProperties;

    @Test
    @DisplayName("Default provider resolves the OpenAI-compatible model")
    void openai_resolvesOpenAiModel() {
        assertThat(aiProperties.isGemini()).isFalse();
        ChatModel active = chatModels.active();
        assertThat(active.getClass().getName())
                .isEqualTo("org.springframework.ai.openai.OpenAiChatModel");
        assertThat(chatModels.activeBeanName()).isEqualTo(AiChatModelResolver.OPENAI_BEAN);
    }
}

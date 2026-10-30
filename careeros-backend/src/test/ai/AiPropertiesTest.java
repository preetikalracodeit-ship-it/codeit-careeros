package com.codeit.careeros.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit-level checks for the provider-specific defaults. These complement the
 * Spring context tests and make the intended behaviour explicit without
 * needing an API key or network access.
 */
class AiPropertiesTest {

    @Test
    @DisplayName("Gemini defaults to the GA model, not the retired 2.0 model")
    void gemini_defaultsToGaModel() {
        AiProperties properties = new AiProperties();
        properties.setProvider("gemini");
        properties.setModel("gpt-4o-mini");
        properties.setGeminiModel("");
        properties.setGeminiApiKey("");
        properties.setApiKey("test-key");

        assertThat(properties.effectiveModel()).isEqualTo("gemini-2.5-flash");
        assertThat(properties.effectiveApiKey()).isEqualTo("test-key");
    }

    @Test
    @DisplayName("GEMINI_MODEL overrides AI_MODEL for Gemini")
    void gemini_explicitModelWins() {
        AiProperties properties = new AiProperties();
        properties.setProvider("gemini");
        properties.setModel("gpt-4o-mini");
        properties.setGeminiModel("gemini-3.8-flash");

        assertThat(properties.effectiveModel()).isEqualTo("gemini-3.8-flash");
    }

    @Test
    @DisplayName("AI_MODEL is used for Gemini when it is not the OpenAI default")
    void gemini_aiModelFallback() {
        AiProperties properties = new AiProperties();
        properties.setProvider("gemini");
        properties.setModel("gemini-2.5-flash-lite");
        properties.setGeminiModel("");

        assertThat(properties.effectiveModel()).isEqualTo("gemini-2.5-flash-lite");
    }

    @Test
    @DisplayName("GEMINI_API_KEY takes precedence over AI_API_KEY")
    void gemini_specificKeyWins() {
        AiProperties properties = new AiProperties();
        properties.setProvider("gemini");
        properties.setApiKey("shared-key");
        properties.setGeminiApiKey("gemini-key");

        assertThat(properties.effectiveApiKey()).isEqualTo("gemini-key");
    }

    @Test
    @DisplayName("Blank and sentinel keys leave the assistant unconfigured")
    void missingOrPlaceholderKey_isNotConfigured() {
        AiProperties blank = new AiProperties();
        blank.setApiKey("");
        assertThat(blank.isConfigured()).isFalse();

        AiProperties sentinel = new AiProperties();
        sentinel.setApiKey("__AI_NOT_CONFIGURED__");
        assertThat(sentinel.isConfigured()).isFalse();

        AiProperties disabled = new AiProperties();
        disabled.setProvider("disabled");
        disabled.setApiKey("real-looking-key");
        assertThat(disabled.isConfigured()).isFalse();
    }

    @Test
    @DisplayName("OpenAI keeps the shared model and key")
    void openAi_usesSharedConfiguration() {
        AiProperties properties = new AiProperties();
        properties.setProvider("openai");
        properties.setModel("gpt-4o-mini");
        properties.setApiKey("openai-key");

        assertThat(properties.effectiveModel()).isEqualTo("gpt-4o-mini");
        assertThat(properties.effectiveApiKey()).isEqualTo("openai-key");
        assertThat(properties.isConfigured()).isTrue();
    }
}

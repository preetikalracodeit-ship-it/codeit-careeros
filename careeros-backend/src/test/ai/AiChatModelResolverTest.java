package com.codeit.careeros.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.ConfigurableApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link AiChatModelResolver} selection rules (no Spring
 * context): explicit primary wins, otherwise the bean matching
 * {@code AI_PROVIDER} is used, otherwise a single implementation is used.
 */
class AiChatModelResolverTest {

    private AiChatModelResolver resolverFor(String provider, ConfigurableApplicationContext context) {
        AiProperties properties = new AiProperties();
        properties.setProvider(provider);
        return new AiChatModelResolver(properties, context);
    }

    private ConfigurableApplicationContext contextWith(ChatModel openAi, ChatModel gemini, String primary) {
        ConfigurableApplicationContext context = Mockito.mock(ConfigurableApplicationContext.class);
        ConfigurableListableBeanFactory beanFactory = Mockito.mock(ConfigurableListableBeanFactory.class);
        Mockito.when(context.getBeanFactory()).thenReturn(beanFactory);

        String[] names;
        if (openAi != null && gemini != null) {
            names = new String[]{AiChatModelResolver.OPENAI_BEAN, AiChatModelResolver.GEMINI_BEAN};
        } else if (openAi != null) {
            names = new String[]{AiChatModelResolver.OPENAI_BEAN};
        } else if (gemini != null) {
            names = new String[]{AiChatModelResolver.GEMINI_BEAN};
        } else {
            names = new String[0];
        }
        Mockito.when(context.getBeanNamesForType(ChatModel.class)).thenReturn(names);
        if (openAi != null) {
            Mockito.when(context.getBean(AiChatModelResolver.OPENAI_BEAN, ChatModel.class))
                    .thenReturn(openAi);
        }
        if (gemini != null) {
            Mockito.when(context.getBean(AiChatModelResolver.GEMINI_BEAN, ChatModel.class))
                    .thenReturn(gemini);
        }
        for (String name : names) {
            BeanDefinition definition = Mockito.mock(BeanDefinition.class);
            Mockito.when(definition.isPrimary()).thenReturn(name.equals(primary));
            Mockito.when(beanFactory.getBeanDefinition(name)).thenReturn(definition);
        }
        return context;
    }

    @Test
    @DisplayName("gemini provider selects the Google model")
    void gemini_selectsGoogle() {
        ChatModel openAi = Mockito.mock(ChatModel.class);
        ChatModel gemini = Mockito.mock(ChatModel.class);
        AiChatModelResolver resolver =
                resolverFor("gemini", contextWith(openAi, gemini, null));
        assertThat(resolver.active()).isSameAs(gemini);
    }

    @Test
    @DisplayName("openai-family providers select the OpenAI-compatible model")
    void openAiFamily_selectsOpenAi() {
        ChatModel openAi = Mockito.mock(ChatModel.class);
        ChatModel gemini = Mockito.mock(ChatModel.class);
        for (String provider : new String[]{"openai", "ollama", "custom", "disabled", ""}) {
            AiChatModelResolver resolver =
                    resolverFor(provider, contextWith(openAi, gemini, null));
            assertThat(resolver.active()).as("provider=%s", provider).isSameAs(openAi);
        }
    }

    @Test
    @DisplayName("explicit @Primary wins over the provider mapping (test stubs)")
    void primary_wins() {
        ChatModel openAi = Mockito.mock(ChatModel.class);
        ChatModel gemini = Mockito.mock(ChatModel.class);
        AiChatModelResolver resolver = resolverFor(
                "gemini", contextWith(openAi, gemini, AiChatModelResolver.OPENAI_BEAN));
        assertThat(resolver.active()).isSameAs(openAi);
    }

    @Test
    @DisplayName("single pinned implementation is used regardless of provider")
    void singleImplementation_used() {
        ChatModel gemini = Mockito.mock(ChatModel.class);
        AiChatModelResolver resolver =
                resolverFor("openai", contextWith(null, gemini, null));
        assertThat(resolver.active()).isSameAs(gemini);
    }

    @Test
    @DisplayName("no ChatModel available surfaces AI_ERROR")
    void none_availableAiError() {
        AiChatModelResolver resolver = resolverFor("gemini", contextWith(null, null, null));
        assertThatThrownBy(resolver::active)
                .isInstanceOf(com.codeit.careeros.exception.BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode",
                        com.codeit.careeros.exception.ErrorCode.AI_ERROR);
    }
}

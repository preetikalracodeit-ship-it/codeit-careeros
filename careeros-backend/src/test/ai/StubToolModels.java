package com.codeit.careeros.ai;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;

/**
 * Helpers for scripted {@code ChatModel} stubs that speak native function
 * calls (like the real OpenAI/Gemini providers) instead of the retired
 * JSON-text tool protocol.
 */
final class StubToolModels {

    private static final AtomicLong IDS = new AtomicLong();

    private StubToolModels() {
    }

    static ChatResponse textAnswer(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }

    static ChatResponse toolCall(String name, String argumentsJson) {
        AssistantMessage message = AssistantMessage.builder()
                .toolCalls(List.of(new AssistantMessage.ToolCall(
                        "stub-call-" + IDS.incrementAndGet(), "function", name,
                        argumentsJson == null ? "{}" : argumentsJson)))
                .build();
        return new ChatResponse(List.of(new Generation(message)));
    }

    static boolean hasToolResponses(Prompt prompt) {
        return countToolResponses(prompt) > 0;
    }

    static long countToolResponses(Prompt prompt) {
        return prompt.getInstructions().stream()
                .filter(message -> message instanceof ToolResponseMessage)
                .count();
    }

    static String lastUserText(Prompt prompt) {
        return prompt.getInstructions().stream()
                .filter(message -> message instanceof UserMessage)
                .map(Message::getText)
                .reduce((first, second) -> second)
                .orElse("");
    }
}

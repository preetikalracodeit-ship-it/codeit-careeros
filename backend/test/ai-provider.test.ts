import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateProviderReply,
  resolveAiProviderConfig,
  type AiChatTurn,
} from "../src/modules/ai/ai.provider.js";

const baseEnvironment = {
  AI_PROVIDER: "openai" as const,
  AI_MODEL: "gpt-4o-mini",
  AI_BASE_URL: "https://api.openai.com/v1",
  AI_API_KEY: "",
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "",
  AI_OFFLINE_FALLBACK: true,
  AI_HISTORY_LIMIT: 20,
  AI_REQUEST_TIMEOUT_SECONDS: 120,
  AI_RATE_LIMIT_PER_MINUTE: 20,
  AI_MAX_RETRIES: 0,
  AI_RETRY_BACKOFF_MILLIS: 0,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AI provider configuration", () => {
  it("uses the provider's Gemini key and model overrides", () => {
    const config = resolveAiProviderConfig({
      ...baseEnvironment,
      AI_PROVIDER: "gemini",
      AI_MODEL: "gemini-2.5-flash",
      AI_API_KEY: "shared-key",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "gemini-3.8-flash",
    });

    expect(config).toMatchObject({
      provider: "gemini",
      model: "gemini-3.8-flash",
      apiKey: "gemini-key",
      configured: true,
    });
  });

  it("uses the Spring-compatible Gemini model default and treats disabled as unconfigured", () => {
    const gemini = resolveAiProviderConfig({
      ...baseEnvironment,
      AI_PROVIDER: "gemini",
      AI_API_KEY: "shared-key",
    });
    const disabled = resolveAiProviderConfig({
      ...baseEnvironment,
      AI_PROVIDER: "disabled",
      AI_API_KEY: "configured-key",
    });

    expect(gemini.model).toBe("gemini-2.5-flash");
    expect(gemini.configured).toBe(true);
    expect(disabled.configured).toBe(false);
  });
});

describe("AI provider requests", () => {
  it("sends context and conversation history to an OpenAI-compatible provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: "A grounded answer." } }],
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const config = resolveAiProviderConfig({
      ...baseEnvironment,
      AI_API_KEY: "test-key",
    });
    const history: AiChatTurn[] = [{ role: "user", content: "What is my target?" }];

    await expect(generateProviderReply(config, "Verified context", history, "Tell me more")).resolves.toBe(
      "A grounded answer.",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(JSON.parse(String(init.body)).messages).toEqual([
      { role: "system", content: "Verified context" },
      ...history,
      { role: "user", content: "Tell me more" },
    ]);
  });

  it("calls Gemini's native API and extracts its text response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Gemini answer." }] } }],
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const config = resolveAiProviderConfig({
      ...baseEnvironment,
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-gemini-key",
    });

    await expect(generateProviderReply(config, "Verified context", [], "Hello")).resolves.toBe("Gemini answer.");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toContain("/models/gemini-2.5-flash:generateContent");
    expect(url.searchParams.get("key")).toBe("test-gemini-key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      systemInstruction: { parts: [{ text: "Verified context" }] },
      contents: [{ role: "user", parts: [{ text: "Hello" }] }],
    });
  });

  it("retries transient provider failures within the configured retry limit", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "Recovered." } }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const config = resolveAiProviderConfig({
      ...baseEnvironment,
      AI_API_KEY: "test-key",
      AI_MAX_RETRIES: 1,
    });

    await expect(generateProviderReply(config, "Context", [], "Question")).resolves.toBe("Recovered.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not issue a request for an unconfigured provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const config = resolveAiProviderConfig(baseEnvironment);

    await expect(generateProviderReply(config, "Context", [], "Question")).rejects.toMatchObject({
      name: "AiProviderError",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

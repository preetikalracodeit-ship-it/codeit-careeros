import { env } from "../../config/env.js";

const UNCONFIGURED_KEY = "__AI_NOT_CONFIGURED__";

export interface AiProviderConfig {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  configured: boolean;
  offlineFallback: boolean;
  historyLimit: number;
  timeoutSeconds: number;
  rateLimitPerMinute: number;
  maxRetries: number;
  retryBackoffMillis: number;
}

export interface AiChatTurn {
  role: "user" | "assistant";
  content: string;
}

type AiEnvironment = Pick<
  typeof env,
  | "AI_PROVIDER"
  | "AI_MODEL"
  | "AI_BASE_URL"
  | "AI_API_KEY"
  | "GEMINI_API_KEY"
  | "GEMINI_MODEL"
  | "AI_OFFLINE_FALLBACK"
  | "AI_HISTORY_LIMIT"
  | "AI_REQUEST_TIMEOUT_SECONDS"
  | "AI_RATE_LIMIT_PER_MINUTE"
  | "AI_MAX_RETRIES"
  | "AI_RETRY_BACKOFF_MILLIS"
>;

export class AiProviderError extends Error {
  constructor(readonly status: number | null) {
    super("AI provider request failed");
    this.name = "AiProviderError";
  }
}

export function resolveAiProviderConfig(source: AiEnvironment = env): AiProviderConfig {
  const provider = source.AI_PROVIDER.trim().toLowerCase();
  const apiKey = provider === "gemini" && source.GEMINI_API_KEY.trim()
    ? source.GEMINI_API_KEY.trim()
    : source.AI_API_KEY.trim();
  const model = provider === "gemini"
    ? source.GEMINI_MODEL.trim()
      || (source.AI_MODEL.trim() && source.AI_MODEL.trim() !== "gpt-4o-mini"
        ? source.AI_MODEL.trim()
        : "gemini-2.5-flash")
    : source.AI_MODEL.trim() || "gpt-4o-mini";

  return {
    provider,
    model,
    baseUrl: (source.AI_BASE_URL.trim() || "https://api.openai.com/v1").replace(/\/+$/, ""),
    apiKey,
    configured: provider !== "disabled" && apiKey.length > 0 && apiKey !== UNCONFIGURED_KEY,
    offlineFallback: source.AI_OFFLINE_FALLBACK,
    historyLimit: source.AI_HISTORY_LIMIT,
    timeoutSeconds: source.AI_REQUEST_TIMEOUT_SECONDS,
    rateLimitPerMinute: source.AI_RATE_LIMIT_PER_MINUTE,
    maxRetries: source.AI_MAX_RETRIES,
    retryBackoffMillis: source.AI_RETRY_BACKOFF_MILLIS,
  };
}

export function getAiStatus() {
  const config = resolveAiProviderConfig();
  return {
    configured: config.configured,
    provider: config.provider,
    model: config.model,
    offlineFallback: config.offlineFallback,
    mode: config.configured ? "llm" : "offline-smart",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractOpenAiText(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return null;
  const first = payload.choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return null;
  const content = first.message.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .filter(isRecord)
      .map((part) => part.text)
      .filter((part): part is string => typeof part === "string")
      .join("")
      .trim();
    return text || null;
  }
  return null;
}

function extractGeminiText(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) return null;
  const first = payload.candidates[0];
  if (!isRecord(first) || !isRecord(first.content) || !Array.isArray(first.content.parts)) return null;
  const text = first.content.parts
    .filter(isRecord)
    .map((part) => part.text)
    .filter((part): part is string => typeof part === "string")
    .join("")
    .trim();
  return text || null;
}

async function waitBeforeRetry(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

async function requestProvider(
  config: AiProviderConfig,
  url: URL,
  init: RequestInit,
): Promise<unknown> {
  let lastStatus: number | null = null;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(config.timeoutSeconds * 1000),
      });
      if (response.ok) {
        try {
          return await response.json() as unknown;
        } catch {
          throw new AiProviderError(response.status);
        }
      }
      lastStatus = response.status;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === config.maxRetries) {
        throw new AiProviderError(response.status);
      }
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      lastStatus = null;
      if (attempt === config.maxRetries) throw new AiProviderError(null);
    }

    await waitBeforeRetry(Math.min(config.retryBackoffMillis * 2 ** attempt, 10000));
  }
  throw new AiProviderError(lastStatus);
}

export async function generateProviderReply(
  config: AiProviderConfig,
  systemPrompt: string,
  history: AiChatTurn[],
  message: string,
): Promise<string> {
  if (!config.configured || config.provider === "disabled") {
    throw new AiProviderError(null);
  }

  if (config.provider === "gemini") {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
    );
    url.searchParams.set("key", config.apiKey);
    const contents = [
      ...history.map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];
    const payload = await requestProvider(config, url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    });
    const reply = extractGeminiText(payload);
    if (!reply) throw new AiProviderError(null);
    return reply;
  }

  const url = new URL(`${config.baseUrl}/chat/completions`);
  const payload = await requestProvider(config, url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  const reply = extractOpenAiText(payload);
  if (!reply) throw new AiProviderError(null);
  return reply;
}

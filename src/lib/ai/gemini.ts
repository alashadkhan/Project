import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { clamp } from "@/lib/utils";
import type { GeminiConfig, LlmClient, LlmRequest } from "@/lib/ai/types";

const DEFAULT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; status?: string };
}

/**
 * Gemini client built on the REST API with structured JSON output.
 *
 * Design notes:
 * - No SDK: one fewer supply-chain dependency, and the request shape is
 *   explicit and easy to audit.
 * - Bounded retries with jitter for 429/5xx, never for 4xx validation errors.
 * - Hard per-call timeout so one slow stage cannot exhaust the request budget.
 * - Provider error text is logged, never returned to the client.
 */
export class GeminiLlm implements LlmClient {
  readonly model: string;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: GeminiConfig) {
    if (!config.apiKey) {
      throw new AppError("PROVIDER_ERROR", "The research provider is not configured.");
    }
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = config.timeoutMs ?? 20_000;
    this.maxRetries = config.maxRetries ?? 2;
  }

  async generate<T>(request: LlmRequest<T>): Promise<T> {
    const url = `${this.endpoint}/models/${encodeURIComponent(this.model)}:generateContent`;

    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      generationConfig: {
        temperature: clamp(request.temperature ?? 0.2, 0, 1),
        maxOutputTokens: request.maxOutputTokens ?? 2048,
        responseMimeType: "application/json",
        responseSchema: request.responseSchema,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      ],
    };

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      const startedAt = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: Response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": this.apiKey,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        const payload = (await response.json().catch(() => ({}))) as GeminiResponse;

        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          lastError = new AppError("PROVIDER_ERROR", "The research provider rejected the request.");
          logger.warn("gemini.request_failed", {
            status: response.status,
            task: request.task,
            providerMessage: payload.error?.message?.slice(0, 200),
          });
          if (!retryable) throw lastError;
          attempt += 1;
          await backoff(attempt);
          continue;
        }

        const text =
          payload.candidates?.[0]?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("")
            .trim() ?? "";

        if (!text) {
          lastError = new AppError("PROVIDER_ERROR", "The research provider returned an empty result.");
          attempt += 1;
          await backoff(attempt);
          continue;
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(text);
        } catch {
          lastError = new AppError("PROVIDER_ERROR", "The research provider returned malformed JSON.");
          attempt += 1;
          await backoff(attempt);
          continue;
        }

        let value: T;
        try {
          value = request.parse(parsedJson);
        } catch {
          // A schema-invalid response is a provider contract violation, not a
          // transient failure: retrying would just repeat it.
          throw new AppError("PROVIDER_ERROR", "The research provider returned an unexpected shape.");
        }

        logger.info("gemini.request_ok", {
          task: request.task,
          model: this.model,
          durationMs: Date.now() - startedAt,
          promptTokens: payload.usageMetadata?.promptTokenCount ?? null,
          outputTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
        });

        return value;
      } catch (error) {
        if (error instanceof AppError) throw error;
        lastError = error;
        attempt += 1;
        if (attempt > this.maxRetries) break;
        await backoff(attempt);
      }
    }

    logger.error("gemini.request_exhausted", {
      task: request.task,
      error: lastError instanceof Error ? lastError.message : "unknown",
    });

    if (lastError instanceof AppError) throw lastError;
    throw new AppError("PROVIDER_ERROR", "The research provider is unavailable right now.");
  }
}

function backoff(attempt: number): Promise<void> {
  const base = Math.min(2000, 250 * 2 ** attempt);
  const jitter = Math.random() * 120;
  return new Promise((resolve) => setTimeout(resolve, base + jitter));
}

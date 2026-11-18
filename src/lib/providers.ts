import { GeminiLlm } from "@/lib/ai/gemini";
import { MockLlm } from "@/lib/ai/mock";
import { MockSearchClient, WikipediaSearchClient } from "@/lib/search/retriever";
import { allowedHostsFromEnv } from "@/lib/security/url-guard";
import type { LlmClient } from "@/lib/ai/types";
import type { SearchClient } from "@/lib/search/retriever";

export type ProviderName = "gemini" | "mock";

export function providerName(): ProviderName {
  const configured = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  return configured === "gemini" ? "gemini" : "mock";
}

/**
 * Provider selection is explicit and server-only. The mock provider is the
 * default so `npm run dev`, tests and CI never require a secret.
 */
export function createLlm(): LlmClient {
  if (providerName() === "gemini") {
    return new GeminiLlm({
      apiKey: process.env.GEMINI_API_KEY ?? "",
      model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
      timeoutMs: Number(process.env.AGENT_TIMEOUT_MS ?? 20_000),
    });
  }
  return new MockLlm();
}

export function createSearch(): SearchClient {
  if (providerName() === "gemini") {
    return new WikipediaSearchClient({
      host: allowedHostsFromEnv(process.env.RETRIEVAL_ALLOWED_HOSTS)[0] ?? "en.wikipedia.org",
    });
  }
  return new MockSearchClient();
}

export function allowedHosts(): string[] {
  return allowedHostsFromEnv(process.env.RETRIEVAL_ALLOWED_HOSTS);
}

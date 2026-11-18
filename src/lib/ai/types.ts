import type { z } from "zod";

export type LlmTask = "plan" | "verify" | "synthesize";

export interface LlmRequest<T> {
  task: LlmTask;
  system: string;
  prompt: string;
  /** JSON Schema sent to the provider for structured output. */
  responseSchema: Record<string, unknown>;
  parse: (value: unknown) => T;
  /**
   * Non-prompt metadata used for observability and by the deterministic mock.
   * Never sent to a real provider as instructions.
   */
  context: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LlmClient {
  readonly model: string;
  generate<T>(request: LlmRequest<T>): Promise<T>;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export type SchemaParser = <T>(schema: z.ZodType<T>) => (value: unknown) => T;

export const parseWith = <T>(schema: z.ZodType<T>) => (value: unknown): T => schema.parse(value);

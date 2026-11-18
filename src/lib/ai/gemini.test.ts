import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { GeminiLlm } from "@/lib/ai/gemini";
import { AppError } from "@/lib/errors";
import type { LlmRequest } from "@/lib/ai/types";

const schema = z.object({ ok: z.boolean() });

const request: LlmRequest<{ ok: boolean }> = {
  task: "plan",
  system: "You are a test.",
  prompt: "Return ok.",
  responseSchema: {
    type: "OBJECT",
    properties: { ok: { type: "BOOLEAN" } },
    required: ["ok"],
  },
  parse: (value) => schema.parse(value),
  context: {},
};

const config = {
  apiKey: "test-key",
  model: "gemini-test",
  maxRetries: 1,
  timeoutMs: 1000,
};

function okResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GeminiLlm", () => {
  it("requires an API key", () => {
    expect(() => new GeminiLlm({ ...config, apiKey: "" })).toThrow(AppError);
  });

  it("calls the model with structured output and a server-side key header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const llm = new GeminiLlm(config);
    await expect(llm.generate(request)).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("gemini-test:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    expect(url).not.toContain("test-key");

    const body = JSON.parse(init.body as string) as {
      generationConfig: { responseMimeType: string; responseSchema: unknown };
    };
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toBeTruthy();
  });

  it("retries a 503 and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(okResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const llm = new GeminiLlm(config);
    await expect(llm.generate(request)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400 and throws a provider error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad request" } }), { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const llm = new GeminiLlm(config);
    await expect(llm.generate(request)).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const llm = new GeminiLlm(config);
    await expect(llm.generate(request)).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty candidate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
      ),
    );

    const llm = new GeminiLlm({ ...config, maxRetries: 0 });
    await expect(llm.generate(request)).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  it("rejects malformed JSON text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "{not json" }] } }] }),
          { status: 200 },
        ),
      ),
    );

    const llm = new GeminiLlm({ ...config, maxRetries: 0 });
    await expect(llm.generate(request)).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  it("rejects a schema-invalid response without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: "yes" }));
    vi.stubGlobal("fetch", fetchMock);

    const llm = new GeminiLlm(config);
    await expect(llm.generate(request)).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

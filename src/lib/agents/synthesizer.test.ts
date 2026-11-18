import { describe, expect, it } from "vitest";

import { buildFallbackSummary, synthesizeReport } from "@/lib/agents/synthesizer";
import type { LlmClient } from "@/lib/ai/types";
import type { Source, VerifiedClaim } from "@/lib/types";

const now = () => Date.parse("2026-11-18T12:00:00.000Z");

const sources: Source[] = [
  {
    id: "S1",
    title: "Octopus",
    url: "https://en.wikipedia.org/wiki/Octopus",
    publisher: "En",
    retrievedAt: "2026-11-18T00:00:00.000Z",
    snippet: "Octopuses have three hearts.",
    reliability: "medium",
  },
];

const claims: VerifiedClaim[] = [
  {
    id: "C1",
    text: "Octopuses have three hearts.",
    stance: "supports",
    confidence: 0.9,
    rationale: "Directly stated.",
    evidence: [{ sourceId: "S1", quote: "Octopuses have three hearts." }],
  },
];

const goodLlm: LlmClient = {
  model: "fake",
  generate: async (request) =>
    request.parse({
      summary: "The evidence supports the claim about octopus hearts, though the corpus is small.",
      limitations: ["Only one source was available."],
      nextSteps: ["Look for a zoology textbook."],
    }),
};

const failingLlm: LlmClient = {
  model: "fake",
  generate: async () => {
    throw new Error("provider down");
  },
};

describe("synthesizeReport", () => {
  it("builds a complete report with deterministic scoring", async () => {
    const report = await synthesizeReport({
      id: "report-1",
      claim: "Octopuses have three hearts.",
      depth: "standard",
      sources,
      claims,
      conflicts: [],
      llm: goodLlm,
      startedAt: now() - 1500,
      now,
    });

    expect(report.id).toBe("report-1");
    expect(report.verdict).toBe("supported");
    expect(report.confidence).toBeGreaterThan(0.3);
    expect(report.summary).toContain("octopus");
    expect(report.durationMs).toBe(1500);
    expect(report.createdAt).toBe("2026-11-18T12:00:00.000Z");
    expect(report.model).toBe("fake");
  });

  it("falls back to a generated summary when the model fails", async () => {
    const report = await synthesizeReport({
      id: "report-2",
      claim: "Octopuses have three hearts.",
      depth: "quick",
      sources,
      claims,
      conflicts: [],
      llm: failingLlm,
      startedAt: now(),
      now,
    });

    expect(report.verdict).toBe("supported");
    expect(report.summary).toContain("Octopuses have three hearts.");
    expect(report.limitations.length).toBeGreaterThan(0);
  });

  it("reports insufficient evidence when no claims survive", async () => {
    const report = await synthesizeReport({
      id: "report-3",
      claim: "An unverifiable claim.",
      depth: "quick",
      sources,
      claims: [],
      conflicts: [],
      llm: goodLlm,
      startedAt: now(),
      now,
    });

    expect(report.verdict).toBe("insufficient_evidence");
    expect(report.claims).toHaveLength(0);
  });
});

describe("buildFallbackSummary", () => {
  it("mentions counts and confidence", () => {
    const summary = buildFallbackSummary("A claim", "mixed", 0.52, claims, sources);
    expect(summary).toContain("mixed");
    expect(summary).toContain("52%");
    expect(summary).toContain("1 sources");
  });
});

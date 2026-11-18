import { describe, expect, it } from "vitest";

import { computeVerdict, MIN_EVIDENCE_MASS, SUPPORT_THRESHOLD } from "@/lib/agents/verdict";
import type { Source, Stance, VerifiedClaim } from "@/lib/types";

function claim(stance: Stance, confidence: number, sourceId = "S1"): VerifiedClaim {
  return {
    id: `C${Math.random().toString(16).slice(2, 6)}`,
    text: "A testable assertion about the world.",
    stance,
    confidence,
    rationale: "Because the source says so.",
    evidence: [{ sourceId, quote: "quoted text" }],
  };
}

const sources: Source[] = [
  {
    id: "S1",
    title: "One",
    url: "https://en.wikipedia.org/wiki/One",
    publisher: "Wikipedia",
    retrievedAt: "2026-01-01T00:00:00.000Z",
    snippet: "snippet",
    reliability: "medium",
  },
  {
    id: "S2",
    title: "Two",
    url: "https://en.wikipedia.org/wiki/Two",
    publisher: "Wikipedia",
    retrievedAt: "2026-01-01T00:00:00.000Z",
    snippet: "snippet",
    reliability: "medium",
  },
];

describe("computeVerdict", () => {
  it("returns insufficient evidence when there are no claims", () => {
    const result = computeVerdict([], sources);
    expect(result.verdict).toBe("insufficient_evidence");
    expect(result.confidence).toBeLessThan(0.35);
  });

  it("returns insufficient evidence below the evidence mass floor", () => {
    const result = computeVerdict([claim("supports", 0.3)], sources);
    expect(MIN_EVIDENCE_MASS).toBeGreaterThan(0.3);
    expect(result.verdict).toBe("insufficient_evidence");
  });

  it("marks a strongly supported claim as supported", () => {
    const result = computeVerdict(
      [claim("supports", 0.9), claim("supports", 0.8)],
      sources,
    );
    expect(result.verdict).toBe("supported");
    expect(result.net).toBeGreaterThanOrEqual(SUPPORT_THRESHOLD);
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it("marks a strongly refuted claim as contradicted", () => {
    const result = computeVerdict(
      [claim("refutes", 0.9), claim("refutes", 0.85)],
      sources,
    );
    expect(result.verdict).toBe("contradicted");
    expect(result.net).toBeLessThanOrEqual(-SUPPORT_THRESHOLD);
  });

  it("marks balanced support and refutation as mixed", () => {
    const result = computeVerdict(
      [claim("supports", 0.8), claim("refutes", 0.8)],
      sources,
    );
    expect(result.verdict).toBe("mixed");
    expect(Math.abs(result.net)).toBeLessThan(SUPPORT_THRESHOLD);
  });

  it("counts mixed stances as uncertainty rather than support", () => {
    const result = computeVerdict([claim("mixed", 1), claim("mixed", 1)], sources);
    expect(result.verdict).toBe("mixed");
    expect(result.net).toBe(0);
  });

  it("clamps confidence out of range", () => {
    const result = computeVerdict([claim("supports", 5), claim("supports", -3)], sources);
    expect(result.confidence).toBeLessThanOrEqual(0.98);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it("increases confidence with more agreeing evidence", () => {
    const small = computeVerdict([claim("supports", 0.6)], sources);
    const large = computeVerdict(
      [claim("supports", 0.6), claim("supports", 0.6), claim("supports", 0.6)],
      sources,
    );
    expect(large.confidence).toBeGreaterThan(small.confidence);
    expect(large.evidenceMass).toBeGreaterThan(small.evidenceMass);
  });

  it("counts only citations that resolve to a known source", () => {
    const result = computeVerdict(
      [claim("supports", 0.9, "S1"), claim("supports", 0.9, "S99")],
      sources,
    );
    expect(result.citedSourceCount).toBe(1);
  });

  it("is deterministic for the same input", () => {
    const claims = [claim("supports", 0.7), claim("refutes", 0.2)];
    expect(computeVerdict(claims, sources)).toEqual(computeVerdict(claims, sources));
  });
});

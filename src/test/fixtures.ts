import type { ResearchReport } from "@/lib/types";

export function makeReport(overrides: Partial<ResearchReport> = {}): ResearchReport {
  const base: ResearchReport = {
    id: "1234abcd-report",
    claim: "Octopuses have three hearts.",
    depth: "standard",
    verdict: "supported",
    confidence: 0.72,
    summary:
      "The available evidence supports the claim that octopuses have three hearts, though the corpus is small.",
    claims: [
      {
        id: "C1",
        text: "Octopuses have three hearts.",
        stance: "supports",
        confidence: 0.9,
        rationale: "The source states this directly.",
        evidence: [{ sourceId: "S1", quote: "Octopuses have three hearts." }],
      },
    ],
    conflicts: [],
    sources: [
      {
        id: "S1",
        title: "Octopus",
        url: "https://en.wikipedia.org/wiki/Octopus",
        publisher: "En",
        retrievedAt: "2026-11-18T10:00:00.000Z",
        snippet: "Octopuses have three hearts and blue blood.",
        reliability: "medium",
      },
    ],
    limitations: ["Only one source was available."],
    nextSteps: ["Look for a zoology textbook."],
    createdAt: "2026-11-18T10:00:05.000Z",
    model: "mock-veritas-1",
    durationMs: 4200,
  };

  return { ...base, ...overrides };
}

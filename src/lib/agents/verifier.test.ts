import { describe, expect, it } from "vitest";

import { verifyEvidence } from "@/lib/agents/verifier";
import type { LlmClient } from "@/lib/ai/types";
import type { Source } from "@/lib/types";

const sources: Source[] = [
  {
    id: "S1",
    title: "Octopus",
    url: "https://en.wikipedia.org/wiki/Octopus",
    publisher: "En",
    retrievedAt: "2026-11-18T00:00:00.000Z",
    snippet: "Octopuses have three hearts and blue blood.",
    reliability: "medium",
  },
  {
    id: "S2",
    title: "Circulatory system",
    url: "https://en.wikipedia.org/wiki/Circulatory_system",
    publisher: "En",
    retrievedAt: "2026-11-18T00:00:00.000Z",
    snippet: "Some cephalopods have multiple hearts.",
    reliability: "medium",
  },
];

function fakeLlm(payload: unknown): LlmClient {
  return {
    model: "fake-model",
    generate: async (request) => request.parse(payload),
  };
}

describe("verifyEvidence", () => {
  it("returns no claims when there are no sources", async () => {
    const result = await verifyEvidence({
      claim: "Octopuses have three hearts.",
      sources: [],
      llm: fakeLlm({ claims: [], conflicts: [] }),
    });

    expect(result).toEqual({ claims: [], conflicts: [] });
  });

  it("assigns server-side ids and keeps valid evidence", async () => {
    const llm = fakeLlm({
      claims: [
        {
          text: "Octopuses have three hearts.",
          stance: "supports",
          confidence: 0.9,
          rationale: "The source states it directly.",
          evidence: [{ sourceId: "S1", quote: "Octopuses have three hearts" }],
        },
      ],
      conflicts: [],
    });

    const result = await verifyEvidence({ claim: "Octopuses have three hearts.", sources, llm });
    expect(result.claims[0]?.id).toBe("C1");
    expect(result.claims[0]?.stance).toBe("supports");
    expect(result.claims[0]?.evidence).toHaveLength(1);
  });

  it("drops citations to unknown sources and downgrades the claim", async () => {
    const llm = fakeLlm({
      claims: [
        {
          text: "An invented fact with a fake citation.",
          stance: "supports",
          confidence: 0.95,
          rationale: "Trust me.",
          evidence: [{ sourceId: "S999", quote: "not in the corpus" }],
        },
      ],
      conflicts: [],
    });

    const result = await verifyEvidence({ claim: "A claim", sources, llm });
    const claim = result.claims[0];
    expect(claim?.evidence).toHaveLength(0);
    expect(claim?.stance).toBe("unclear");
    expect(claim?.confidence).toBeLessThanOrEqual(0.3);
  });

  it("clamps out-of-range confidence", async () => {
    const llm = fakeLlm({
      claims: [
        {
          text: "A claim with silly confidence.",
          stance: "supports",
          confidence: 7,
          rationale: "Overconfident.",
          evidence: [{ sourceId: "S1", quote: "Octopuses have three hearts" }],
        },
      ],
      conflicts: [],
    });

    const result = await verifyEvidence({ claim: "A claim", sources, llm });
    expect(result.claims[0]?.confidence).toBe(1);
  });

  it("filters conflict references to known claims and sources", async () => {
    const llm = fakeLlm({
      claims: [
        {
          text: "Octopuses have three hearts.",
          stance: "mixed",
          confidence: 0.6,
          rationale: "Partly supported.",
          evidence: [{ sourceId: "S1", quote: "three hearts" }],
        },
      ],
      conflicts: [
        {
          topic: "Heart count",
          description: "Sources phrase the count differently.",
          claimIds: ["C1", "C42"],
          sourceIds: ["S1", "S88"],
        },
      ],
    });

    const result = await verifyEvidence({ claim: "A claim", sources, llm });
    expect(result.conflicts[0]?.claimIds).toEqual(["C1"]);
    expect(result.conflicts[0]?.sourceIds).toEqual(["S1"]);
    expect(result.conflicts[0]?.id).toBe("X1");
  });

  it("removes duplicate evidence for the same source and quote", async () => {
    const llm = fakeLlm({
      claims: [
        {
          text: "Octopuses have three hearts.",
          stance: "supports",
          confidence: 0.8,
          rationale: "Stated twice.",
          evidence: [
            { sourceId: "S1", quote: "Octopuses have three hearts" },
            { sourceId: "S1", quote: "Octopuses have three hearts" },
          ],
        },
      ],
      conflicts: [],
    });

    const result = await verifyEvidence({ claim: "A claim", sources, llm });
    expect(result.claims[0]?.evidence).toHaveLength(1);
  });
});

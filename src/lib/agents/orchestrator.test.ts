import { describe, expect, it } from "vitest";

import { runResearch } from "@/lib/agents/orchestrator";
import { MockLlm } from "@/lib/ai/mock";
import { MockSearchClient } from "@/lib/search/retriever";
import { AppError } from "@/lib/errors";
import type { ResearchEvent } from "@/lib/types";
import type { LlmClient } from "@/lib/ai/types";

const deps = {
  llm: new MockLlm(),
  search: new MockSearchClient(),
  allowedHosts: ["en.wikipedia.org"],
  timeoutMs: 5000,
};

describe("runResearch", () => {
  it("emits events in pipeline order and ends with a report", async () => {
    const events: ResearchEvent[] = [];
    const report = await runResearch({
      claim: "Octopuses have three hearts.",
      depth: "standard",
      deps,
      emit: (event) => events.push(event),
    });

    const typeOrder = events.map((event) => event.type);
    expect(typeOrder[0]).toBe("status");
    expect(typeOrder).toContain("subquestions");
    expect(typeOrder).toContain("source");
    expect(typeOrder).toContain("claims");
    expect(typeOrder.at(-1)).toBe("report");

    expect(report.claims.length).toBeGreaterThan(0);
    expect(report.sources.length).toBeGreaterThan(0);
    expect(report.verdict).not.toBe("insufficient_evidence");
  });

  it("emits a completed status for every agent", async () => {
    const events: ResearchEvent[] = [];
    await runResearch({
      claim: "Octopuses have three hearts.",
      depth: "quick",
      deps,
      emit: (event) => events.push(event),
    });

    const completed = events
      .filter((event) => event.type === "status" && event.phase === "completed")
      .map((event) => (event.type === "status" ? event.agent : ""));

    expect(new Set(completed)).toEqual(
      new Set(["planner", "retriever", "verifier", "synthesizer"]),
    );
  });

  it("maps a timeout to a typed TIMEOUT error", async () => {
    const slowLlm: LlmClient = {
      model: "slow",
      generate: () => new Promise(() => undefined),
    };

    await expect(
      runResearch({
        claim: "This claim will time out.",
        depth: "quick",
        deps: { ...deps, llm: slowLlm, timeoutMs: 40 },
        emit: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("maps unexpected failures to a safe INTERNAL error", async () => {
    const brokenLlm: LlmClient = {
      model: "broken",
      generate: async () => {
        throw new Error("kaboom: secret details");
      },
    };

    await expect(
      runResearch({
        claim: "This claim will fail.",
        depth: "quick",
        deps: { ...deps, llm: brokenLlm },
        emit: () => undefined,
      }),
    ).rejects.toBeInstanceOf(AppError);

    await runResearch({
      claim: "This claim will fail.",
      depth: "quick",
      deps: { ...deps, llm: brokenLlm },
      emit: () => undefined,
    }).catch((error: AppError) => {
      expect(error.code).toBe("INTERNAL");
      expect(error.message).not.toContain("secret");
    });
  });

  it("still produces a report when retrieval returns nothing", async () => {
    const emptySearch = { name: "empty", search: async () => [] };
    const events: ResearchEvent[] = [];

    const report = await runResearch({
      claim: "Nothing will be found for this claim.",
      depth: "quick",
      deps: { ...deps, search: emptySearch },
      emit: (event) => events.push(event),
    });

    expect(report.sources).toHaveLength(0);
    expect(report.verdict).toBe("insufficient_evidence");
    expect(events.some((event) => event.type === "status" && event.message === "No sources found")).toBe(
      true,
    );
  });
});

import { planResearch } from "@/lib/agents/planner";
import { verifyEvidence } from "@/lib/agents/verifier";
import { synthesizeReport } from "@/lib/agents/synthesizer";
import { retrieveSources } from "@/lib/search/retriever";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { TimeoutError, withTimeout } from "@/lib/utils";
import type { Depth, EventSink, ResearchReport, Source, SubQuestion } from "@/lib/types";
import type { LlmClient } from "@/lib/ai/types";
import type { SearchClient } from "@/lib/search/retriever";

export interface ResearchDeps {
  llm: LlmClient;
  search: SearchClient;
  allowedHosts: readonly string[];
  now?: () => number;
  /** Hard ceiling for a single run, including all model calls. */
  timeoutMs?: number;
}

export interface RunResearchInput {
  claim: string;
  depth: Depth;
  deps: ResearchDeps;
  emit: EventSink;
  signal?: AbortSignal;
}

/**
 * Orchestrates the four agents and emits typed progress events.
 *
 * Failure policy:
 * - A failed retrieval for one question is tolerated (see retriever), but a
 *   total retrieval failure still lets the verifier return "insufficient
 *   evidence" rather than inventing facts.
 * - Provider failures abort the run with a safe, typed error.
 * - The whole run is bounded by `timeoutMs`, so a slow provider cannot hold a
 *   Cloud Run request open until the platform kills it.
 */
export async function runResearch(input: RunResearchInput): Promise<ResearchReport> {
  const now = input.deps.now ?? Date.now;
  const startedAt = now();
  const timeoutMs = input.deps.timeoutMs ?? 55_000;

  const status = (
    agent: "planner" | "retriever" | "verifier" | "synthesizer",
    phase: "started" | "completed",
    message: string,
    durationMs?: number,
  ) => {
    input.emit({
      type: "status",
      agent,
      phase,
      message,
      at: new Date(now()).toISOString(),
      ...(durationMs === undefined ? {} : { durationMs }),
    });
  };

  const stages = async (): Promise<ResearchReport> => {
    // 1. Plan -------------------------------------------------------------
    status("planner", "started", "Decomposing the claim into research questions");
    const planStart = now();
    const questions: SubQuestion[] = await planResearch({
      claim: input.claim,
      depth: input.depth,
      llm: input.deps.llm,
    });
    status("planner", "completed", `${questions.length} research questions ready`, now() - planStart);
    input.emit({ type: "subquestions", questions });

    // 2. Retrieve ---------------------------------------------------------
    status("retriever", "started", "Searching allowlisted sources");
    const retrieveStart = now();
    const sources: Source[] = await retrieveSources({
      questions,
      depth: input.depth,
      search: input.deps.search,
      allowedHosts: input.deps.allowedHosts,
      now,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    for (const source of sources) input.emit({ type: "source", source });
    status(
      "retriever",
      "completed",
      sources.length === 0 ? "No sources found" : `${sources.length} sources retrieved`,
      now() - retrieveStart,
    );

    // 3. Verify -----------------------------------------------------------
    status("verifier", "started", "Checking each assertion against the sources");
    const verifyStart = now();
    const { claims, conflicts } = await verifyEvidence({
      claim: input.claim,
      sources,
      llm: input.deps.llm,
    });
    input.emit({ type: "claims", claims });
    input.emit({ type: "conflicts", conflicts });
    status("verifier", "completed", `${claims.length} assertions assessed`, now() - verifyStart);

    // 4. Synthesize -------------------------------------------------------
    status("synthesizer", "started", "Writing the evidence-backed report");
    const synthesizeStart = now();
    const report = await synthesizeReport({
      id: crypto.randomUUID(),
      claim: input.claim,
      depth: input.depth,
      sources,
      claims,
      conflicts,
      llm: input.deps.llm,
      startedAt,
      now,
    });
    status("synthesizer", "completed", "Report ready", now() - synthesizeStart);

    input.emit({ type: "report", report });
    return report;
  };

  try {
    return await withTimeout(stages(), timeoutMs, "The research run exceeded its time budget.");
  } catch (error) {
    if (error instanceof TimeoutError) {
      logger.warn("research.timeout", { depth: input.depth, timeoutMs });
      throw new AppError("TIMEOUT", "The research run took too long. Try a quicker depth.");
    }
    if (error instanceof AppError) throw error;
    logger.error("research.failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new AppError("INTERNAL", "The research run failed unexpectedly.");
  }
}

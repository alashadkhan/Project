import type { LlmClient } from "@/lib/ai/types";
import { parseWith } from "@/lib/ai/types";
import { synthesisOutputSchema } from "@/lib/schemas";
import { synthesizerSystemPrompt, synthesizerUserPrompt } from "@/lib/agents/prompts";
import { computeVerdict, stanceCounts } from "@/lib/agents/verdict";
import { safeText } from "@/lib/security/sanitize";
import { logger } from "@/lib/logger";
import type { Conflict, Depth, ResearchReport, Source, VerifiedClaim, Verdict } from "@/lib/types";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    limitations: { type: "ARRAY", minItems: 1, maxItems: 5, items: { type: "STRING" } },
    nextSteps: { type: "ARRAY", minItems: 1, maxItems: 5, items: { type: "STRING" } },
  },
  required: ["summary", "limitations", "nextSteps"],
} as const;

const VERDICT_LABEL: Record<Verdict, string> = {
  supported: "Supported",
  contradicted: "Contradicted",
  mixed: "Mixed evidence",
  insufficient_evidence: "Insufficient evidence",
};

export interface SynthesizeInput {
  id: string;
  claim: string;
  depth: Depth;
  sources: readonly Source[];
  claims: readonly VerifiedClaim[];
  conflicts: readonly Conflict[];
  llm: LlmClient;
  startedAt: number;
  now: () => number;
}

/**
 * Synthesizer agent.
 *
 * The verdict and confidence come from the deterministic formula in
 * `verdict.ts`; the model only writes prose around it. If the model fails, the
 * report is still returned with a generated summary — a degraded narrative is
 * better than a failed fact-check.
 */
export async function synthesizeReport(input: SynthesizeInput): Promise<ResearchReport> {
  const { claim, depth, sources, claims, conflicts, llm } = input;
  const scoring = computeVerdict(claims, sources);

  const fallbackSummary = buildFallbackSummary(claim, scoring.verdict, scoring.confidence, claims, sources);

  let prose = {
    summary: fallbackSummary,
    limitations: [
      "Automated verification can miss context that a domain expert would catch.",
      "Sources are limited to the retrieval allowlist, so coverage may be incomplete.",
    ],
    nextSteps: [
      "Open the cited sources and read the surrounding context.",
      "Re-run with a narrower claim to improve evidence quality.",
    ],
  };

  try {
    const output = await llm.generate({
      task: "synthesize",
      system: synthesizerSystemPrompt(),
      prompt: synthesizerUserPrompt({
        claim,
        verdict: scoring.verdict,
        confidence: scoring.confidence,
        claims: claims.map((item) => ({ stance: item.stance, text: item.text })),
        sourceCount: sources.length,
      }),
      responseSchema: RESPONSE_SCHEMA,
      parse: parseWith(synthesisOutputSchema),
      context: { claim, sourceIds: sources.map((source) => source.id) },
      temperature: 0.2,
      maxOutputTokens: 900,
    });

    prose = {
      summary: safeText(output.summary, 1200) || fallbackSummary,
      limitations: output.limitations.map((item) => safeText(item, 240)).filter(Boolean),
      nextSteps: output.nextSteps.map((item) => safeText(item, 240)).filter(Boolean),
    };
  } catch (error) {
    logger.warn("synthesizer.fallback", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  return {
    id: input.id,
    claim,
    depth,
    verdict: scoring.verdict,
    confidence: scoring.confidence,
    summary: prose.summary,
    claims: [...claims],
    conflicts: [...conflicts],
    sources: [...sources],
    limitations: prose.limitations.length > 0 ? prose.limitations : [fallbackSummary],
    nextSteps: prose.nextSteps.length > 0 ? prose.nextSteps : ["Retry with a deeper run."],
    createdAt: new Date(input.now()).toISOString(),
    model: llm.model,
    durationMs: Math.max(0, input.now() - input.startedAt),
  };
}

export function buildFallbackSummary(
  claim: string,
  verdict: Verdict,
  confidence: number,
  claims: readonly VerifiedClaim[],
  sources: readonly Source[],
): string {
  const counts = stanceCounts(claims);
  const label = VERDICT_LABEL[verdict].toLowerCase();
  return safeText(
    `The evidence is ${label} for the claim "${claim}". ${counts.supports} of ${claims.length} checked assertions were supported, ${counts.refutes} refuted and ${counts.mixed} mixed, across ${sources.length} sources. Confidence is ${(confidence * 100).toFixed(0)}%. Treat this as a starting point and read the cited evidence.`,
    1200,
  );
}

import type { LlmClient } from "@/lib/ai/types";
import { verifierOutputSchema } from "@/lib/schemas";
import { verifierSystemPrompt, verifierUserPrompt } from "@/lib/agents/prompts";
import { asUntrusted, safeText } from "@/lib/security/sanitize";
import { clamp, uniqueBy } from "@/lib/utils";
import type { Conflict, Source, VerifiedClaim } from "@/lib/types";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    claims: {
      type: "ARRAY",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          stance: { type: "STRING", enum: ["supports", "refutes", "mixed", "unclear"] },
          confidence: { type: "NUMBER" },
          rationale: { type: "STRING" },
          evidence: {
            type: "ARRAY",
            maxItems: 6,
            items: {
              type: "OBJECT",
              properties: {
                sourceId: { type: "STRING" },
                quote: { type: "STRING" },
              },
              required: ["sourceId", "quote"],
            },
          },
        },
        required: ["text", "stance", "confidence", "rationale", "evidence"],
      },
    },
    conflicts: {
      type: "ARRAY",
      maxItems: 5,
      items: {
        type: "OBJECT",
        properties: {
          topic: { type: "STRING" },
          description: { type: "STRING" },
          claimIds: { type: "ARRAY", items: { type: "STRING" } },
          sourceIds: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["topic", "description", "claimIds", "sourceIds"],
      },
    },
  },
  required: ["claims", "conflicts"],
} as const;

export interface VerifyOutput {
  claims: VerifiedClaim[];
  conflicts: Conflict[];
}

/**
 * Verifier agent: maps each assertion to a stance and evidence.
 *
 * Post-processing is defensive, because model output is untrusted input too:
 * - unknown source ids are dropped so citations always resolve;
 * - claims without surviving evidence are downgraded to "unclear";
 * - confidence is clamped and ids are re-issued server-side.
 */
export async function verifyEvidence(input: {
  claim: string;
  sources: readonly Source[];
  llm: LlmClient;
}): Promise<VerifyOutput> {
  const { claim, sources, llm } = input;

  // No sources means no evidence. Do not ask the model to improvise.
  if (sources.length === 0) {
    return { claims: [], conflicts: [] };
  }

  const sourcesBlock = sources
    .map((source) => asUntrusted(source.id, `${source.title}. ${source.snippet}`))
    .join("\n");

  const output = await llm.generate({
    task: "verify",
    system: verifierSystemPrompt(),
    prompt: verifierUserPrompt(claim, sourcesBlock),
    responseSchema: RESPONSE_SCHEMA,
    parse: (value) => verifierOutputSchema.parse(value),
    context: { claim, sourceIds: sources.map((source) => source.id) },
    temperature: 0.1,
    maxOutputTokens: 2600,
  });

  const knownSources = new Set(sources.map((source) => source.id));

  const claims: VerifiedClaim[] = output.claims.map((claim, index) => {
    const evidence = uniqueBy(
      claim.evidence
        .filter((ref) => knownSources.has(ref.sourceId))
        .map((ref) => ({
          sourceId: ref.sourceId,
          quote: safeText(ref.quote, 400),
        }))
        .filter((ref) => ref.quote.length > 0),
      (ref) => `${ref.sourceId}:${ref.quote.slice(0, 40)}`,
    );

    const hasEvidence = evidence.length > 0;

    return {
      id: `C${index + 1}`,
      text: safeText(claim.text, 400),
      stance: hasEvidence ? claim.stance : "unclear",
      confidence: hasEvidence ? clamp(claim.confidence, 0, 1) : Math.min(0.3, clamp(claim.confidence, 0, 1)),
      rationale: safeText(claim.rationale, 600),
      evidence,
    };
  });

  const claimIds = new Set(claims.map((claim) => claim.id));
  const conflicts: Conflict[] = output.conflicts.map((conflict, index) => ({
    id: `X${index + 1}`,
    topic: safeText(conflict.topic, 120),
    description: safeText(conflict.description, 600),
    claimIds: conflict.claimIds.filter((id) => claimIds.has(id)),
    sourceIds: conflict.sourceIds.filter((id) => knownSources.has(id)),
  }));

  return { claims, conflicts };
}

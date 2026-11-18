import type { Source, Stance, Verdict, VerifiedClaim } from "@/lib/types";
import { clamp } from "@/lib/utils";

/**
 * Deterministic verdict scoring.
 *
 * Judges and users should be able to see *why* a verdict was reached, so this
 * module is deliberately a small, pure function instead of another model call.
 * It is covered by unit tests and documented in docs/SCORING.md.
 *
 * Definitions
 * -----------
 * - supportMass = sum of confidence for claims with stance "supports"
 * - refuteMass  = sum of confidence for claims with stance "refutes"
 * - mixedMass   = sum of confidence for "mixed" claims, halved (they count as
 *                 evidence of uncertainty, not as support in either direction)
 * - evidenceMass = supportMass + refuteMass + mixedMass
 * - net = (supportMass - refuteMass) / evidenceMass   (range -1..1)
 *
 * Rules
 * -----
 * - evidenceMass < MIN_EVIDENCE_MASS  -> "insufficient_evidence"
 * - net >= SUPPORT_THRESHOLD          -> "supported"
 * - net <= -SUPPORT_THRESHOLD         -> "contradicted"
 * - otherwise                         -> "mixed"
 *
 * Confidence blends three independent signals, so one strong claim cannot
 * masquerade as a well-evidenced conclusion:
 * - volume: evidenceMass / (evidenceMass + 2)
 * - consistency: |net|
 * - source coverage: distinct cited sources / 3
 */

export const SUPPORT_THRESHOLD = 0.4;
export const MIN_EVIDENCE_MASS = 0.75;

export interface VerdictResult {
  verdict: Verdict;
  confidence: number;
  evidenceMass: number;
  net: number;
  citedSourceCount: number;
}

export function computeVerdict(
  claims: readonly VerifiedClaim[],
  sources: readonly Source[],
): VerdictResult {
  let supportMass = 0;
  let refuteMass = 0;
  let mixedMass = 0;

  for (const claim of claims) {
    const confidence = clamp(claim.confidence, 0, 1);
    if (claim.stance === "supports") supportMass += confidence;
    else if (claim.stance === "refutes") refuteMass += confidence;
    else if (claim.stance === "mixed") mixedMass += confidence / 2;
  }

  const evidenceMass = supportMass + refuteMass + mixedMass;
  const net = evidenceMass === 0 ? 0 : (supportMass - refuteMass) / evidenceMass;

  const cited = new Set<string>();
  for (const claim of claims) for (const ref of claim.evidence) cited.add(ref.sourceId);
  const knownSources = new Set(sources.map((source) => source.id));
  const citedSourceCount = [...cited].filter((id) => knownSources.has(id)).length;

  if (claims.length === 0 || evidenceMass < MIN_EVIDENCE_MASS) {
    return {
      verdict: "insufficient_evidence",
      confidence: round(clamp(0.08 + 0.25 * (evidenceMass / MIN_EVIDENCE_MASS), 0, 0.35)),
      evidenceMass: round(evidenceMass),
      net: round(net),
      citedSourceCount,
    };
  }

  const verdict: Verdict =
    net >= SUPPORT_THRESHOLD
      ? "supported"
      : net <= -SUPPORT_THRESHOLD
        ? "contradicted"
        : "mixed";

  const volume = evidenceMass / (evidenceMass + 2);
  const consistency = Math.abs(net);
  const coverage = Math.min(1, citedSourceCount / 3);

  const confidence = clamp(0.15 + 0.55 * volume + 0.2 * consistency + 0.1 * coverage, 0, 0.98);

  return {
    verdict,
    confidence: round(confidence),
    evidenceMass: round(evidenceMass),
    net: round(net),
    citedSourceCount,
  };
}

export function stanceCounts(claims: readonly VerifiedClaim[]): Record<Stance, number> {
  const counts: Record<Stance, number> = { supports: 0, refutes: 0, mixed: 0, unclear: 0 };
  for (const claim of claims) counts[claim.stance] += 1;
  return counts;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

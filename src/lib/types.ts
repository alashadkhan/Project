/**
 * Shared domain types for the Veritas research pipeline.
 *
 * The pipeline is a directed graph of four agents:
 *
 *   Planner -> Retriever -> Verifier -> Synthesizer
 *
 * Every stage emits typed `ResearchEvent`s so the UI can render progress
 * without polling, and so the whole run is observable in tests.
 */

export const DEPTHS = ["quick", "standard", "deep"] as const;
export type Depth = (typeof DEPTHS)[number];

export const AGENTS = ["planner", "retriever", "verifier", "synthesizer"] as const;
export type AgentName = (typeof AGENTS)[number];

export type Stance = "supports" | "refutes" | "mixed" | "unclear";
export type Verdict = "supported" | "contradicted" | "mixed" | "insufficient_evidence";
export type Reliability = "high" | "medium" | "low";

export interface SubQuestion {
  /** Stable, human-readable id, e.g. "Q1". */
  id: string;
  question: string;
}

export interface Source {
  /** Stable id used by evidence references, e.g. "S1". */
  id: string;
  title: string;
  url: string;
  publisher: string;
  /** ISO-8601 timestamp of retrieval. */
  retrievedAt: string;
  /** Short extract used as evidence. Never rendered as raw HTML. */
  snippet: string;
  reliability: Reliability;
}

export interface EvidenceRef {
  sourceId: string;
  /** Verbatim-ish supporting text. Sanitised before rendering. */
  quote: string;
}

export interface VerifiedClaim {
  id: string;
  text: string;
  stance: Stance;
  /** 0..1, clamped server-side. */
  confidence: number;
  rationale: string;
  evidence: EvidenceRef[];
}

export interface Conflict {
  id: string;
  topic: string;
  description: string;
  claimIds: string[];
  sourceIds: string[];
}

export interface ResearchReport {
  id: string;
  claim: string;
  depth: Depth;
  verdict: Verdict;
  /** 0..1, produced by a deterministic, documented formula (see verdict.ts). */
  confidence: number;
  summary: string;
  claims: VerifiedClaim[];
  conflicts: Conflict[];
  sources: Source[];
  limitations: string[];
  nextSteps: string[];
  createdAt: string;
  model: string;
  durationMs: number;
}

export type ResearchErrorCode =
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "INTERNAL";

export type ResearchEvent =
  | {
      type: "status";
      agent: AgentName;
      phase: "started" | "completed";
      message: string;
      at: string;
      durationMs?: number;
    }
  | { type: "subquestions"; questions: SubQuestion[] }
  | { type: "source"; source: Source }
  | { type: "claims"; claims: VerifiedClaim[] }
  | { type: "conflicts"; conflicts: Conflict[] }
  | { type: "report"; report: ResearchReport }
  | { type: "error"; code: ResearchErrorCode; message: string };

export interface ResearchRequest {
  claim: string;
  depth: Depth;
}

export type EventSink = (event: ResearchEvent) => void;

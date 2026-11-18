"use client";

import { useCallback, useRef, useState } from "react";

import type {
  AgentName,
  Conflict,
  Depth,
  ResearchEvent,
  ResearchReport,
  Source,
  SubQuestion,
  VerifiedClaim,
} from "@/lib/types";

export type Phase = "idle" | "running" | "done" | "error";

export interface StepState {
  status: "pending" | "active" | "done";
  message?: string;
  durationMs?: number;
}

export interface ResearchState {
  phase: Phase;
  steps: Record<AgentName, StepState>;
  questions: SubQuestion[];
  sources: Source[];
  claims: VerifiedClaim[];
  conflicts: Conflict[];
  report: ResearchReport | null;
  error: string | null;
}

const INITIAL_STEPS: Record<AgentName, StepState> = {
  planner: { status: "pending" },
  retriever: { status: "pending" },
  verifier: { status: "pending" },
  synthesizer: { status: "pending" },
};

export const initialState: ResearchState = {
  phase: "idle",
  steps: INITIAL_STEPS,
  questions: [],
  sources: [],
  claims: [],
  conflicts: [],
  report: null,
  error: null,
};

/**
 * Talks to /api/research over NDJSON and reduces the event stream into UI state.
 *
 * NDJSON (one JSON object per line) is easier to parse incrementally than SSE
 * and avoids the EventSource API, which cannot send a POST body.
 */
export function useResearch() {
  const [state, setState] = useState<ResearchState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    setState(initialState);
  }, [stop]);

  const start = useCallback(async (claim: string, depth: Depth) => {
    stop();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState({ ...initialState, phase: "running" });

    const apply = (event: ResearchEvent) => {
      setState((current) => {
        switch (event.type) {
          case "status":
            return {
              ...current,
              steps: {
                ...current.steps,
                [event.agent]: {
                  status: event.phase === "started" ? "active" : "done",
                  message: event.message,
                  ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }),
                },
              },
            };
          case "subquestions":
            return { ...current, questions: event.questions };
          case "source":
            return { ...current, sources: [...current.sources, event.source] };
          case "claims":
            return { ...current, claims: event.claims };
          case "conflicts":
            return { ...current, conflicts: event.conflicts };
          case "report":
            return {
              ...current,
              phase: "done",
              report: event.report,
              sources: event.report.sources,
              claims: event.report.claims,
              conflicts: event.report.conflicts,
              steps: Object.fromEntries(
                (Object.keys(current.steps) as AgentName[]).map((agent) => [
                  agent,
                  { ...current.steps[agent], status: "done" as const },
                ]),
              ) as Record<AgentName, StepState>,
            };
          case "error":
            return { ...current, phase: "error", error: event.message };
          default:
            return current;
        }
      });
    };

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/x-ndjson" },
        body: JSON.stringify({ claim, depth }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message ?? "The research request was rejected.");
      }
      if (!response.body) throw new Error("The server returned an empty response.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) {
            try {
              apply(JSON.parse(line) as ResearchEvent);
            } catch {
              // Ignore a malformed line rather than killing an otherwise good run.
            }
          }
          newline = buffer.indexOf("\n");
        }
      }

      setState((current) =>
        current.phase === "running" ? { ...current, phase: "done" } : current,
      );
    } catch (error) {
      if (controller.signal.aborted) {
        setState((current) => ({ ...current, phase: current.report ? "done" : "idle" }));
        return;
      }
      setState((current) => ({
        ...current,
        phase: "error",
        error: error instanceof Error ? error.message : "Something went wrong.",
      }));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [stop]);

  return { state, start, stop, reset };
}

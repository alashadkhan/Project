import type { AgentName } from "@/lib/types";

import type { StepState } from "@/hooks/useResearch";

const AGENTS: Array<{ id: AgentName; name: string; role: string }> = [
  { id: "planner", name: "Planner", role: "Splits the claim into testable questions" },
  { id: "retriever", name: "Retriever", role: "Fetches allowlisted, citable sources" },
  { id: "verifier", name: "Verifier", role: "Scores every assertion against evidence" },
  { id: "synthesizer", name: "Synthesizer", role: "Writes the report and verdict" },
];

const STATUS_TEXT: Record<StepState["status"], string> = {
  pending: "Waiting",
  active: "In progress",
  done: "Done",
};

export function AgentTimeline({
  steps,
  running,
}: {
  steps: Record<AgentName, StepState>;
  running: boolean;
}) {
  return (
    <ol className="space-y-1" aria-label="Agent pipeline progress">
      {AGENTS.map((agent, index) => {
        const step = steps[agent.id];
        const isActive = step.status === "active";

        return (
          <li
            key={agent.id}
            aria-current={isActive ? "step" : undefined}
            className={`flex items-start gap-4 rounded-xl px-3 py-3 transition-colors ${
              isActive ? "bg-raised/70" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${
                step.status === "done"
                  ? "border-support/50 bg-support/10 text-support"
                  : isActive
                    ? "animate-pulse-ring border-accent/60 bg-accent/10 text-accent"
                    : "border-line bg-surface text-muted"
              }`}
            >
              {step.status === "done" ? "✓" : index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-ink">{agent.name}</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  {STATUS_TEXT[step.status]}
                  {step.durationMs !== undefined ? ` · ${Math.round(step.durationMs)}ms` : ""}
                </p>
              </div>
              <p className="mt-0.5 text-sm text-muted">{step.message ?? agent.role}</p>
            </div>
          </li>
        );
      })}
      <li className="sr-only" aria-live="polite">
        {running
          ? AGENTS.map((agent) => `${agent.name}: ${STATUS_TEXT[steps[agent.id].status]}`).join(". ")
          : ""}
      </li>
    </ol>
  );
}

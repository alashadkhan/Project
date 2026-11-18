"use client";

import { useId, useRef, useState } from "react";

import { AgentTimeline } from "@/components/AgentTimeline";
import { ReportView } from "@/components/ReportView";
import { useResearch } from "@/hooks/useResearch";
import type { Depth } from "@/lib/types";

const EXAMPLES = [
  "Drinking coffee stunts growth in teenagers.",
  "The Great Wall of China is visible from space with the naked eye.",
  "Octopuses have three hearts.",
  "Lightning never strikes the same place twice.",
];

const DEPTH_OPTIONS: Array<{ value: Depth; label: string; detail: string }> = [
  { value: "quick", label: "Quick", detail: "2 questions · fastest" },
  { value: "standard", label: "Standard", detail: "3 questions · balanced" },
  { value: "deep", label: "Deep", detail: "5 questions · most sources" },
];

export function ResearchConsole() {
  const { state, start, stop, reset } = useResearch();
  const [claim, setClaim] = useState("");
  const [depth, setDepth] = useState<Depth>("standard");
  const [validation, setValidation] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const claimId = useId();
  const hintId = useId();
  const errorId = useId();

  const running = state.phase === "running";
  const stepSummary = running
    ? Object.values(state.steps)
        .filter((step) => step.message)
        .map((step) => step.message)
        .join(". ")
    : "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = claim.trim();
    if (trimmed.length < 8) {
      setValidation("Please enter at least 8 characters so there is something to check.");
      textareaRef.current?.focus();
      return;
    }
    if (trimmed.length > 600) {
      setValidation("Please keep the claim under 600 characters.");
      textareaRef.current?.focus();
      return;
    }
    setValidation(null);
    void start(trimmed, depth);
  }

  function applyExample(example: string) {
    setClaim(example);
    setValidation(null);
    textareaRef.current?.focus();
  }

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit} className="card p-6 sm:p-8" aria-labelledby="form-heading" noValidate>
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="form-heading" className="font-serif text-xl font-semibold">
            Run a check
          </h2>
          <span className="label-mono">Step 1 of 2</span>
        </div>

        <div className="mt-6 space-y-2">
          <label htmlFor={claimId} className="block text-sm font-medium">
            Claim or question
          </label>
          <textarea
            id={claimId}
            ref={textareaRef}
            className="field min-h-[104px] resize-y"
            value={claim}
            maxLength={600}
            onChange={(event) => {
              setClaim(event.target.value);
              if (validation) setValidation(null);
            }}
            aria-describedby={`${hintId}${validation ? ` ${errorId}` : ""}`}
            aria-invalid={validation ? true : undefined}
            placeholder="e.g. The Sahara is the largest hot desert on Earth."
            disabled={running}
            autoComplete="off"
          />
          <div className="flex items-start justify-between gap-4">
            <p id={hintId} className="text-xs text-muted">
              Specific, checkable claims produce better reports. {claim.length}/600
            </p>
          </div>
          {validation && (
            <p id={errorId} role="alert" className="text-sm font-medium text-refute">
              {validation}
            </p>
          )}
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium">Research depth</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {DEPTH_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="cursor-pointer rounded-xl border border-line bg-canvas/60 p-4 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2"
              >
                <input
                  type="radio"
                  name="depth"
                  value={option.value}
                  checked={depth === option.value}
                  onChange={() => setDepth(option.value)}
                  className="sr-only"
                  disabled={running}
                />
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{option.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={running}>
            {running ? "Checking…" : "Check this claim"}
          </button>
          {running ? (
            <button type="button" className="btn-ghost" onClick={stop}>
              Stop
            </button>
          ) : (
            state.phase !== "idle" && (
              <button type="button" className="btn-ghost" onClick={reset}>
                Clear
              </button>
            )
          )}
        </div>

        <div className="mt-6 border-t border-line/70 pt-4">
          <p className="label-mono">Try one</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  className="chip hover:border-accent/50 hover:text-ink"
                  onClick={() => applyExample(example)}
                  disabled={running}
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </form>

      <p className="sr-only" aria-live="polite">
        {stepSummary}
      </p>

      {(running || state.phase === "done" || state.phase === "error") && (
        <section aria-labelledby="pipeline-heading" className="card p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="pipeline-heading" className="font-serif text-xl font-semibold">
              Agent pipeline
            </h2>
            <span className="label-mono">Step 2 of 2</span>
          </div>

          <div className="mt-5">
            <AgentTimeline steps={state.steps} running={running} />
          </div>

          {state.questions.length > 0 && (
            <div className="mt-6 border-t border-line/70 pt-4">
              <p className="label-mono">Research questions</p>
              <ul className="mt-2 grid gap-2 text-sm text-muted">
                {state.questions.map((question) => (
                  <li key={question.id} className="flex gap-2">
                    <span className="font-mono text-xs text-accent">{question.id}</span>
                    {question.question}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.sources.length > 0 && !state.report && (
            <p className="mt-4 font-mono text-xs text-muted">
              {state.sources.length} sources retrieved…
            </p>
          )}
        </section>
      )}

      {state.error && (
        <div role="alert" className="card border-refute/40 bg-refute/5 p-5">
          <h2 className="text-sm font-semibold text-refute">That run did not finish</h2>
          <p className="mt-1 text-sm text-muted">{state.error}</p>
        </div>
      )}

      {state.report && <ReportView report={state.report} onReset={reset} />}
    </div>
  );
}

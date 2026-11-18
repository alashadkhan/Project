"use client";

import { useEffect, useRef, useState } from "react";

import { ClaimCard } from "@/components/ClaimCard";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { SourceList } from "@/components/SourceList";
import { VerdictBadge } from "@/components/VerdictBadge";
import { reportToMarkdown } from "@/lib/export";
import type { ResearchReport } from "@/lib/types";

interface ReportViewProps {
  report: ResearchReport;
  onReset: () => void;
}

export function ReportView({ report, onReset }: ReportViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  // Move focus to the result once it exists, so keyboard and screen-reader
  // users are not left at the submit button while content appears below.
  useEffect(() => {
    headingRef.current?.focus();
  }, [report.id]);

  const markdown = reportToMarkdown(report);

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyState("copied");
      setAnnouncement("Markdown report copied to clipboard.");
    } catch {
      setCopyState("failed");
      setAnnouncement("Copy failed. Use the download button instead.");
    }
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `veritas-report-${report.id.slice(0, 8)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setAnnouncement("Markdown report downloaded.");
  }

  return (
    <section aria-labelledby="report-heading" className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-mono">Report {report.id.slice(0, 8)}</p>
          <h2
            id="report-heading"
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 font-serif text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
          >
            Verification report
          </h2>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={copyMarkdown}>
            {copyState === "copied" ? "Copied" : "Copy Markdown"}
          </button>
          <button type="button" className="btn-ghost" onClick={downloadMarkdown}>
            Download
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="card overflow-hidden">
        <div className="border-b border-line/70 bg-raised/40 p-6 sm:p-8">
          <VerdictBadge verdict={report.verdict} large />
          <blockquote className="mt-4 font-serif text-xl leading-snug text-ink sm:text-2xl">
            “{report.claim}”
          </blockquote>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <ConfidenceMeter confidence={report.confidence} />
            <dl className="grid grid-cols-2 gap-3 font-mono text-xs text-muted">
              <div>
                <dt className="uppercase tracking-wider">Claims</dt>
                <dd className="mt-1 text-lg text-ink">{report.claims.length}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wider">Sources</dt>
                <dd className="mt-1 text-lg text-ink">{report.sources.length}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wider">Depth</dt>
                <dd className="mt-1 text-sm capitalize text-ink">{report.depth}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wider">Runtime</dt>
                <dd className="mt-1 text-sm text-ink">{(report.durationMs / 1000).toFixed(1)}s</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h3 className="label-mono">Summary</h3>
          <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink/90">{report.summary}</p>
        </div>
      </div>

      {report.conflicts.length > 0 && (
        <section aria-labelledby="conflicts-heading" className="card border-caution/30 p-6">
          <h3 id="conflicts-heading" className="text-base font-semibold text-caution">
            Conflicting evidence
          </h3>
          <ul className="mt-3 space-y-3">
            {report.conflicts.map((conflict) => (
              <li key={conflict.id}>
                <p className="text-sm font-medium text-ink">{conflict.topic}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{conflict.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="claims-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="claims-heading" className="font-serif text-xl font-semibold">
            Claim by claim
          </h3>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            {report.claims.length} assertions
          </p>
        </div>

        {report.claims.length === 0 ? (
          <p className="card p-5 text-sm text-muted">
            The sources did not contain enough verifiable material. Try a narrower or more specific
            claim.
          </p>
        ) : (
          <div className="grid gap-4">
            {report.claims.map((claim) => (
              <ClaimCard key={claim.id} claim={claim} sources={report.sources} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="sources-heading" className="space-y-4">
        <h3 id="sources-heading" className="font-serif text-xl font-semibold">
          Sources
        </h3>
        <SourceList sources={report.sources} />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="limits-heading" className="card p-6">
          <h3 id="limits-heading" className="label-mono">
            Limitations
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            {report.limitations.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-caution">
                  —
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="next-heading" className="card p-6">
          <h3 id="next-heading" className="label-mono">
            Next steps
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            {report.nextSteps.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-accent">
                  →
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-6">
        <p className="font-mono text-[11px] text-muted">
          model: {report.model} · verdict computed deterministically
        </p>
        <button type="button" className="btn-primary" onClick={onReset}>
          Check another claim
        </button>
      </div>
    </section>
  );
}

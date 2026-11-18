import type { Source, Stance, VerifiedClaim } from "@/lib/types";

const STANCE_STYLE: Record<Stance, { label: string; className: string }> = {
  supports: { label: "Supports", className: "border-support/40 bg-support/10 text-support" },
  refutes: { label: "Refutes", className: "border-refute/40 bg-refute/10 text-refute" },
  mixed: { label: "Mixed", className: "border-caution/40 bg-caution/10 text-caution" },
  unclear: { label: "Unclear", className: "border-line bg-raised text-muted" },
};

export function ClaimCard({
  claim,
  sources,
}: {
  claim: VerifiedClaim;
  sources: readonly Source[];
}) {
  const stance = STANCE_STYLE[claim.stance];
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return (
    <article className="card p-5" aria-labelledby={`claim-${claim.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted">{claim.id}</span>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stance.className}`}>
          {stance.label}
        </span>
        <span className="font-mono text-xs text-muted">
          {Math.round(claim.confidence * 100)}% confidence
        </span>
      </div>

      <h3 id={`claim-${claim.id}`} className="mt-3 text-base font-semibold leading-snug text-ink">
        {claim.text}
      </h3>

      <p className="mt-2 text-sm leading-relaxed text-muted">{claim.rationale}</p>

      {claim.evidence.length > 0 && (
        <ul className="mt-4 space-y-3">
          {claim.evidence.map((ref, index) => {
            const source = sourceById.get(ref.sourceId);
            return (
              <li key={`${claim.id}-${ref.sourceId}-${index}`} className="border-l-2 border-line pl-4">
                <blockquote className="text-sm italic leading-relaxed text-ink/90">
                  “{ref.quote}”
                </blockquote>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  {source ? (
                    <>
                      <span aria-hidden="true">[{ref.sourceId}] </span>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="link-underline"
                      >
                        {source.title}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </>
                  ) : (
                    `Unknown source ${ref.sourceId}`
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {claim.evidence.length === 0 && (
        <p className="mt-3 text-xs text-muted">
          No source supported this assertion, so it was downgraded to “unclear”.
        </p>
      )}
    </article>
  );
}

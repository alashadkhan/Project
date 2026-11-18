import type { Source } from "@/lib/types";

const RELIABILITY_STYLE: Record<Source["reliability"], string> = {
  high: "border-support/40 bg-support/10 text-support",
  medium: "border-caution/40 bg-caution/10 text-caution",
  low: "border-line bg-raised text-muted",
};

export function SourceList({ sources }: { sources: readonly Source[] }) {
  if (sources.length === 0) {
    return <p className="text-sm text-muted">No sources were retrieved for this run.</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {sources.map((source) => (
        <li key={source.id} className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-muted">{source.id}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                RELIABILITY_STYLE[source.reliability]
              }`}
            >
              {source.reliability} reliability
            </span>
          </div>
          <h3 className="mt-2 text-sm font-semibold leading-snug">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="link-underline"
            >
              {source.title}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </h3>
          <p className="mt-1 text-xs text-muted">{source.publisher}</p>
          <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-muted">{source.snippet}</p>
        </li>
      ))}
    </ul>
  );
}

import type { Verdict } from "@/lib/types";

const STYLES: Record<Verdict, { label: string; className: string; glyph: string }> = {
  supported: {
    label: "Supported",
    className: "border-support/40 bg-support/10 text-support",
    glyph: "✓",
  },
  contradicted: {
    label: "Contradicted",
    className: "border-refute/40 bg-refute/10 text-refute",
    glyph: "✕",
  },
  mixed: {
    label: "Mixed evidence",
    className: "border-caution/40 bg-caution/10 text-caution",
    glyph: "≈",
  },
  insufficient_evidence: {
    label: "Insufficient evidence",
    className: "border-line bg-raised text-muted",
    glyph: "?",
  },
};

export function verdictLabel(verdict: Verdict): string {
  return STYLES[verdict].label;
}

export function VerdictBadge({ verdict, large = false }: { verdict: Verdict; large?: boolean }) {
  const style = STYLES[verdict];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-semibold ${style.className} ${
        large ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs"
      }`}
    >
      <span aria-hidden="true" className="font-mono">
        {style.glyph}
      </span>
      {style.label}
    </span>
  );
}

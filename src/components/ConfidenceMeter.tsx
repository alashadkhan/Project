export function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  const tone = percent >= 70 ? "bg-support" : percent >= 45 ? "bg-caution" : "bg-refute";

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-mono">Confidence</span>
        <span className="font-mono text-sm text-ink">{percent}%</span>
      </div>
      <div
        role="meter"
        aria-label="Confidence in this verdict"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent} percent confidence`}
        className="h-2 w-full overflow-hidden rounded-full bg-raised"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

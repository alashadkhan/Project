import Link from "next/link";

import { ResearchConsole } from "@/components/ResearchConsole";

// The CSP nonce is generated per request in `src/proxy.ts` and injected into
// the script tags by Next.js. A statically prerendered page would ship script
// tags without that nonce, so the browser would block hydration. Rendering this
// route per request keeps the nonce and the markup in sync.
export const dynamic = "force-dynamic";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com";

const DIFFERENTIATORS = [
  {
    title: "The verdict is a formula",
    body: "Verdicts are computed from weighted stances by a pure, unit-tested function — not by asking a model how it feels. Every percentage can be reproduced.",
  },
  {
    title: "No citation, no claim",
    body: "The verifier may only cite source ids it was given. Unknown ids are dropped, and unsupported assertions are automatically downgraded to “unclear”.",
  },
  {
    title: "Built like production",
    body: "SSRF-guarded retrieval, strict request validation, per-IP rate limits, nonce-based CSP, bounded concurrency and a deterministic offline mode for tests.",
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(246,178,74,0.12),transparent_70%)]"
      />

      <header className="relative border-b border-line/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-lg">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/40 bg-accent/10 font-serif text-lg font-bold text-accent"
            >
              V
            </span>
            <span className="text-base font-semibold tracking-tight">Veritas</span>
            <span className="hidden rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted sm:inline">
              PS03
            </span>
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-2">
            <a
              href="/api/health"
              className="btn-ghost hidden sm:inline-flex"
              aria-label="Service health endpoint"
            >
              Health
            </a>
            <a
              href={REPO_URL}
              className="btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </nav>
        </div>
      </header>

      <main id="main" className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <section className="py-12 sm:py-16" aria-labelledby="hero-heading">
          <p className="label-mono">Multi-agent research &amp; fact-checking</p>
          <h1
            id="hero-heading"
            className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Check the claim.
            <br />
            <span className="text-accent">Not the vibe.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Veritas runs four cooperating agents over a claim, retrieves real sources, and
            publishes a verdict with the receipts. Every citation resolves. Every percentage is
            reproducible.
          </p>
        </section>

        <ResearchConsole />

        <section aria-labelledby="why-heading" className="mt-20">
          <h2 id="why-heading" className="font-serif text-2xl font-semibold">
            Why this is not another chatbot
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {DIFFERENTIATORS.map((item) => (
              <article key={item.title} className="card p-5">
                <h3 className="text-sm font-semibold text-accent">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="method-heading" className="mt-16">
          <div className="card p-6 sm:p-8">
            <h2 id="method-heading" className="font-serif text-2xl font-semibold">
              How the verdict is scored
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              Each assertion carries a stance and a confidence. Support and refute mass decide the
              direction; evidence volume, agreement and source coverage decide the confidence.
              Retrieval returning too little evidence produces “insufficient evidence” instead of a
              guess.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-xl border border-line bg-canvas/80 p-4 font-mono text-xs leading-relaxed text-ink/90">
              <code>{`net = (supportMass − refuteMass) / evidenceMass

net ≥ +0.40                → Supported
net ≤ −0.40                → Contradicted
otherwise                  → Mixed evidence
evidenceMass < 0.75        → Insufficient evidence

confidence = 0.15
           + 0.55 · volume(evidenceMass)
           + 0.20 · |net|
           + 0.10 · coverage(sources)`}</code>
            </pre>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            Built for <span className="text-ink">PromptWars x Agent X 2.0</span> · Problem statement
            PS03 · Solo build by Alashad Khan
          </p>
          <p className="font-mono">
            Four agents · Gemini · Cloud Run
          </p>
        </div>
      </footer>
    </div>
  );
}

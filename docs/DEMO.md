# Demo script (90 seconds)

Use this for the LinkedIn video, the jury pitch, or a live run.

## Before you start

- Deployed URL open in a clean tab, `AI_PROVIDER=gemini`
- Terminal ready with `npm run test:coverage` (optional proof of tests)

## Script

**0:00 — Frame the problem.** “Search gives answers with confidence and no evidence. For a
fact-check, the evidence trail *is* the product. This is Veritas.”

**0:10 — Run a claim.** Type: *Drinking coffee stunts growth in teenagers.* Pick **Standard**,
press **Check this claim**.

**0:15 — Narrate the pipeline.** Point at the agent timeline as it advances: “Planner decomposes
it, Retriever pulls allowlisted sources, Verifier labels every assertion, Synthesizer writes the
report.”

**0:30 — Show the verdict.** “Notice the verdict is not a model opinion. Support mass minus refute
mass over total evidence — a pure function. 0.4 either way. That is why the number is
reproducible.”

**0:45 — Open a citation.** Click a source. “Every claim carries a quote and a resolvable link.
No citation, no claim.”

**1:00 — Show the guardrails.** Point at the limitations card, then the conflicting-evidence card
if present. “It tells you when it does not know.”

**1:10 — Engineering proof.** Switch to the terminal: `npm run test:coverage`. “105 tests, coverage
gates in CI, Playwright and axe for accessibility, CodeQL for security.”

**1:25 — Close.** “Four agents, one evidence trail. Veritas.”

## Backup claim (if the first returns thin evidence)

- *The Great Wall of China is visible from space with the naked eye.* (Expect contradicted/mixed.)
- *Octopuses have three hearts.* (Expect supported.)

## Failure drills

| If… | Say… | Do… |
| --- | --- | --- |
| Provider error | “The provider is rate-limited; the app fails closed.” | Retry once, or switch to the backup claim |
| No sources | “It refuses to guess.” | Show `insufficient evidence` and the limitations |
| Slow run | “Every run has a hard 55-second ceiling.” | Point at the timeline; the run is cancellable |

# Veritas — evidence-backed fact-checking

**Four agents, one evidence trail.** Veritas takes a claim, decomposes it into research
questions, retrieves allowlisted sources, verifies each assertion, and publishes a verdict
where every percentage is reproducible and every citation resolves.

Built for **PromptWars x Agent X 2.0** — problem statement **PS03: Multi-Agent Research &
Fact-Checking**.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Tests](https://img.shields.io/badge/tests-105%20passing-2ea043)
![Coverage](https://img.shields.io/badge/coverage-89.7%25%20lines-2ea043)
![License](https://img.shields.io/badge/license-MIT-blue)

- **Live app:** Cloud Run — one command in [DEPLOY.md](DEPLOY.md) prints the public URL
- **Source:** [github.com/alashadkhan/Project](https://github.com/alashadkhan/Project)
- **Health check:** `/api/health`
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **How it is scored:** [docs/SCORING.md](docs/SCORING.md)

---

## The problem

Search engines answer with confidence, not evidence. A single retrieved page can be outdated,
misread, or contradicted elsewhere, and most "AI research" tools hide which source produced
which sentence. For fact-checking, that is the whole ballgame: **the evidence trail is the
product**.

## What Veritas does

1. **Planner** splits the claim into 2–5 neutral, independently searchable questions.
2. **Retriever** queries Wikipedia's Action API, validates every URL against an SSRF guard,
   deduplicates, and assigns stable source ids (`S1`, `S2`, …).
3. **Verifier** labels each assertion `supports` / `refutes` / `mixed` / `unclear`, with a quote
   and a confidence. Citations to unknown sources are dropped; claims without surviving
   evidence are downgraded to `unclear`.
4. **Synthesizer** computes the verdict with a deterministic formula, then writes a neutral
   summary. If the model fails, the report still ships with a generated summary.

The UI streams the whole run as NDJSON, so the pipeline is visible while it happens — not a
spinner followed by an oracle.

## Why the verdict is trustworthy

The verdict is **not** another model call. `src/lib/agents/verdict.ts` is a pure function:

```text
supportMass = Σ confidence where stance = supports
refuteMass  = Σ confidence where stance = refutes
mixedMass   = Σ confidence where stance = mixed  (halved)
evidenceMass = supportMass + refuteMass + mixedMass

net = (supportMass − refuteMass) / evidenceMass

net ≥ +0.40          → Supported
net ≤ −0.40          → Contradicted
otherwise            → Mixed evidence
evidenceMass < 0.75  → Insufficient evidence

confidence = 0.15 + 0.55·volume + 0.20·|net| + 0.10·coverage
```

It is covered by unit tests and documented in [docs/SCORING.md](docs/SCORING.md), so a judge can
recompute any verdict by hand.

## Quick start

**No API key or network required** — the default provider is a deterministic mock, which is what
the test suite and CI use.

```bash
npm install
npm run dev          # http://localhost:3000
```

To run against real sources and a real model:

```bash
cp .env.example .env.local
# set AI_PROVIDER=gemini and GEMINI_API_KEY=... (free key: https://aistudio.google.com/apikey)
npm run dev
```

### Verify everything

```bash
npm run lint          # ESLint, zero warnings tolerated
npm run typecheck     # TypeScript strict
npm run test:coverage # 105 unit/component tests + coverage gates
npm run build         # production build
npm run test:e2e      # Playwright + axe (downloads Chromium once)
```

## Architecture

```mermaid
flowchart LR
    U[Browser] -->|POST claim + depth| API[/api/research]
    API --> R{rate limit<br/>Zod validation}
    R -->|ok| P[Planner agent]
    P --> Q[Research questions]
    Q --> T[Retriever agent]
    T -->|allowlist + SSRF guard| W[(Wikipedia Action API)]
    W --> S[Sources S1..Sn]
    S --> V[Verifier agent]
    V --> C[Claims + stances + quotes]
    C --> D[Deterministic verdict]
    D --> Y[Synthesizer agent]
    Y --> REP[Report]
    REP -->|NDJSON stream| U
    R -->|blocked| E[429 + Retry-After]
```

Full detail, including trust boundaries and failure modes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project structure

```text
src/
  app/
    page.tsx                 # landing + console
    layout.tsx               # metadata, skip link
    globals.css              # design tokens, focus, reduced motion
    api/research/route.ts    # streaming POST endpoint
    api/health/route.ts      # liveness/readiness
  components/                # timeline, report, claims, sources, meter
  hooks/useResearch.ts       # NDJSON reducer
  lib/
    agents/                  # planner, retriever, verifier, synthesizer, verdict
    ai/                      # Gemini REST client + deterministic mock
    search/                  # Wikipedia client + mock + retrieval policy
    security/                # SSRF guard, rate limiting, sanitisation
    schemas.ts               # Zod contracts (input and model output)
    cache.ts                 # LRU + TTL
  proxy.ts                   # per-request CSP nonce
e2e/                         # Playwright + axe
docs/                        # architecture, security, testing, scoring, demo
```

## Rubric map

| Criterion | Where to look |
| --- | --- |
| Code quality | Strict TypeScript (`noUncheckedIndexedAccess`), layered modules, no `any`, documented pure functions, ESLint zero-warning CI |
| Security | SSRF allowlist, nonce CSP, security headers, Zod validation, rate limiting, prompt-injection isolation, Secret Manager, CodeQL |
| Efficiency | LRU+TTL cache, bounded retrieval concurrency, depth-based budgets, streaming, no client data fetching, small client bundle |
| Testing | 105 Vitest tests, Playwright E2E, axe accessibility checks, coverage thresholds in CI |
| Accessibility | WCAG 2.2 AA target, landmarks, skip link, focus transfer, live regions, meter semantics, reduced motion, forced-colors |
| Google services | Gemini 3.8 Flash structured output, Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Cloud Logging |
| Problem alignment | PS03 exactly: planner → multi-source retrieval → cross-checking → conflict reporting → evidence-backed report |

Details and evidence links: [docs/SCORING.md](docs/SCORING.md).

## API

`POST /api/research` — `application/json`

```json
{ "claim": "Octopuses have three hearts.", "depth": "standard" }
```

Responds with `application/x-ndjson`, one event per line:

```json
{"type":"status","agent":"planner","phase":"started","message":"…","at":"…"}
{"type":"subquestions","questions":[{"id":"Q1","question":"…"}]}
{"type":"source","source":{"id":"S1","title":"…","url":"…","reliability":"medium"}}
{"type":"claims","claims":[{"id":"C1","stance":"supports","confidence":0.82}]}
{"type":"report","report":{"verdict":"supported","confidence":0.71}}
{"type":"error","code":"RATE_LIMITED","message":"…"}
```

| Status | Meaning |
| --- | --- |
| 400 | Invalid body or claim length |
| 405 | Non-POST request |
| 413 | Body over 4 KiB |
| 429 | Per-IP limit (`Retry-After` set) |
| 200 + `error` event | Provider failure or run timeout — the stream closes with a typed error |

`GET /api/health` returns `{ status, version, provider, region, uptimeSeconds }` and never leaks
secrets.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `mock` | `mock` (deterministic) or `gemini` |
| `GEMINI_API_KEY` | — | Server-side key; Secret Manager in production |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Model id (use `gemini-flash-latest` to track the newest Flash) |
| `AGENT_TIMEOUT_MS` | `20000` | Per model call |
| `RESEARCH_TIMEOUT_MS` | `55000` | Whole run |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `8` / `60000` | Per-IP budget |
| `RETRIEVAL_ALLOWED_HOSTS` | `en.wikipedia.org` | SSRF allowlist |

## Deployment

Cloud Run, one command, in Cloud Shell: see [DEPLOY.md](DEPLOY.md).

```bash
bash scripts/deploy-cloudrun.sh
```

The container runs as a non-root user, exposes `$PORT`, has a health check, and is built from a
multi-stage Dockerfile. `render.yaml` is included as a fallback host.

## Accessibility

WCAG 2.2 AA is a build requirement, not an afterthought: semantic landmarks, visible focus,
skip link, `aria-live` progress, `role="meter"` confidence, keyboard-only paths, 4.5:1 contrast,
`prefers-reduced-motion` and `forced-colors` support. See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).

## Security

See [SECURITY.md](SECURITY.md) for the threat model and reporting process. Highlights: no secret
ever reaches the client, retrieved text is treated as hostile, and the retriever cannot reach
private networks or the cloud metadata endpoint.

## Limitations

- Retrieval is restricted to Wikipedia extracts: broad coverage, shallow depth. Primary sources
  are linked for follow-up rather than ingested.
- Confidence is a calibrated heuristic over evidence volume and agreement, not a statistical
  probability.
- English-only corpus by default.
- Long claims with several independent assertions produce a single aggregate verdict.

## License

MIT — see [LICENSE](LICENSE).

Built solo by **Alashad Khan** for PromptWars x Agent X 2.0.

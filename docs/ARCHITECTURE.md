# Architecture

## Shape of the system

Veritas is a single Next.js application with a server-only agent pipeline. There is no database:
a research run is a bounded, stateless computation, and the report is returned to the client that
asked for it. That keeps the blast radius small and the deployment cheap.

```text
Browser (React client component)
   │  POST /api/research  {claim, depth}
   ▼
Route handler (Node runtime)
   ├── rate limiter (per IP, fixed window)
   ├── body-size + Zod validation
   ├── report cache (LRU + TTL, per instance)
   └── orchestrator
         ├── Planner   → LLM (structured JSON)
         ├── Retriever → Wikipedia Action API (allowlisted, SSRF-guarded)
         ├── Verifier  → LLM (structured JSON, citations validated)
         └── Synthesizer → deterministic verdict + LLM prose (fallback safe)
   │  NDJSON stream (one event per line)
   ▼
Browser reducer → agent timeline → report view
```

## Why this decomposition

| Decision | Reason |
| --- | --- |
| Four agents, not one prompt | Each stage has a narrow contract, its own schema, and can fail independently. Verification is the only stage allowed to make factual judgments. |
| Deterministic verdict | A model asked "is this true?" is unaccountable. A pure function over stances is testable, explainable and reproducible. |
| Wikipedia as the corpus | Free, no key, stable permalinks, encyclopaedic tone. The allowlist makes the security boundary explicit. |
| NDJSON over SSE | Streaming a POST body needs `fetch`, not `EventSource`. One JSON object per line is trivial to parse incrementally. |
| No client-side model calls | The API key never leaves the server, and prompts cannot be tampered with from the browser. |
| Stateless + in-memory cache | A demo does not need Redis. The `TtlCache` interface is narrow enough to swap for Memorystore. |

## Trust boundaries

1. **User input** → validated by Zod, length-capped, control characters stripped.
2. **Retrieved text** → untrusted. Wrapped in `<untrusted_source>` delimiters, HTML-stripped,
   bidi/zero-width characters removed, and never rendered as HTML.
3. **Model output** → untrusted. Parsed against a Zod schema, source ids checked against the
   retrieved set, confidence clamped, ids re-issued server-side.
4. **Provider errors** → logged with detail, surfaced as a generic typed error.
5. **Deployment** → non-root container, Secret Manager for the key, per-request CSP nonce.

Prompt injection is handled structurally: the system prompt states the instruction hierarchy, and
retrieved text cannot close its own wrapper (the closing tag is stripped).

## Data contracts

`src/lib/types.ts` defines the domain objects (`Source`, `VerifiedClaim`, `Conflict`,
`ResearchReport`, `ResearchEvent`). `src/lib/schemas.ts` defines the wire contracts:

- `researchRequestSchema` — input, `.strict()`, 8–600 characters.
- `plannerOutputSchema` — 2–6 questions.
- `verifierOutputSchema` — 1–8 claims, bounded evidence, bounded conflicts.
- `synthesisOutputSchema` — summary, 1–5 limitations, 1–5 next steps.

Every model response passes through one of these before it can influence the UI.

## Failure modes

| Failure | Behaviour |
| --- | --- |
| One retrieval query fails | Logged, other questions still used |
| Every retrieval query fails | Report produced with `insufficient_evidence` |
| Model returns invalid JSON | One retry (if transport-level), then typed `PROVIDER_ERROR` |
| Model returns unknown source ids | Citations dropped; claim downgraded to `unclear` |
| Summary call fails | Deterministic summary used; report still returned |
| Run exceeds budget | `TIMEOUT`, streamed as an error event |
| Client disconnects | `AbortController` cancels retrieval and closes the stream |

## CSP nonce and rendering

The home route is rendered per request (`export const dynamic = "force-dynamic"`). This is a
deliberate consequence of the nonce-based CSP: a statically prerendered page would ship script tags
generated at build time, while the proxy issues a fresh nonce per response, so the browser would
block hydration. Rendering the route per request keeps the nonce and the markup in sync. The page
has no server-side data fetching, so the cost is one HTML render per visit — not a database call.

The trade-off is documented here because it is the kind of thing that looks like a missing
optimisation until you know why it is there.

## Performance budget

| Path | Target | Mechanism |
| --- | --- | --- |
| First paint | < 100 kB JS | No UI framework beyond React, CSS-only visuals |
| Retrieval | ≤ 5 parallel queries, 8 s each | `Promise.allSettled`, per-request abort |
| Full run | < 55 s hard ceiling | `withTimeout`, depth-based question counts |
| Repeat claim | ~0 ms | `TtlCache`, 15 min, keyed by provider+depth+claim |

## Extending

- **New corpus:** implement `SearchClient` and add the host to `RETRIEVAL_ALLOWED_HOSTS`.
- **New model:** implement `LlmClient`; the pipeline only needs `generate()`.
- **Persistence:** add a `ReportStore` beside `reportCache`; ids are already UUIDs.
- **Multi-tenant limits:** replace `FixedWindowRateLimiter`'s map with Redis.

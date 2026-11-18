# Testing

## Commands

```bash
npm test              # 105 unit + component tests
npm run test:coverage # same, with coverage gates
npm run test:e2e      # Playwright + axe (starts the app itself)
npm run lint
npm run typecheck
npm run verify        # lint + typecheck + coverage + build
```

## Layers

| Layer | Tool | Covers |
| --- | --- | --- |
| Pure logic | Vitest | verdict maths, cache TTL/LRU, rate limiting, SSRF guard, sanitisation, Zod contracts, Markdown export |
| Agents | Vitest + fakes | planner depth behaviour, verifier citation filtering, synthesizer fallback, orchestrator event order and failure mapping |
| Provider | Vitest + mocked `fetch` | structured request shape, retry policy, non-retryable errors, malformed and schema-invalid responses, key never in URL |
| Components | Testing Library + jsdom | form validation, streamed report rendering, focus transfer, meter semantics, copy-to-clipboard, error states |
| End-to-end | Playwright | full claim → report flow in a real browser, keyboard-only path, axe scan |

## Running the browser suite

`npm run test:e2e` starts the app itself on port 3100 with the mock provider, then drives Chromium.

```bash
npx playwright install chromium   # once
npm run test:e2e
```

If the download is blocked, reuse an installed browser instead:

```bash
E2E_CHANNEL=msedge npm run test:e2e     # Windows: $env:E2E_CHANNEL="msedge"
E2E_CHANNEL=chrome  npm run test:e2e
```

The config reuses a server that is already listening on port 3100. If you started
that server by hand, stop it first: the suite needs `RATE_LIMIT_MAX=100`, and a
server on the default limit of 8 answers `429` after six claims, which makes every
report-flow test time out with a confusing "report never appeared" failure.

Screenshots for the README are generated the same way, against a running server:

```bash
npm run build && npm run start -- --port 3100
npm run screenshot
```

## Coverage gates

`vitest.config.ts` fails the build below:

- 85% lines, 85% statements, 85% functions, 80% branches

CI runs the same command, so a red gate blocks a merge.

## What is intentionally not tested

- Live Gemini responses (non-deterministic and rate-limited). The client is tested against a
  mocked `fetch`; a smoke test against the real API belongs in a nightly job.
- Live Wikipedia content. The retriever is tested with injected `SearchClient` fakes, and the
  URL policy is tested independently.
- Visual regression. Accessibility is asserted structurally with axe and semantics instead.

## Determinism

The default provider is `mock`, so `npm test` and `npm run dev` need no key and no network. The
mock returns fixtures, not fake intelligence — it exists to exercise orchestration, validation,
scoring and UI.

## Adding a test

1. Pure function → colocate as `foo.test.ts`.
2. Agent → inject a fake `LlmClient` or `SearchClient`; never call the network.
3. Component → render with Testing Library; assert roles and accessible names, not CSS classes.
4. End-to-end → add a spec under `e2e/`; the web server is started by `playwright.config.ts`.

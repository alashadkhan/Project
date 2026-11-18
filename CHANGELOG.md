# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-11-18

First public release, built for **PromptWars x Agent X 2.0**, problem statement
**PS03: Multi-Agent Research & Fact-Checking**.

### Added

- **Four-agent pipeline:** planner → retriever → verifier → synthesizer, streamed to the client as
  NDJSON so progress is observable while a run happens.
- **Deterministic verdict function** (`src/lib/agents/verdict.ts`): support/refute mass, a
  minimum evidence floor, and a confidence formula blending volume, consistency and source
  coverage. Documented in `docs/SCORING.md`.
- **Citation integrity:** model citations are validated against the retrieved source set; unknown
  ids are dropped and unsupported claims are downgraded to `unclear`.
- **Retrieval:** Wikipedia Action API client with stable permalinks, URL deduplication, and a
  depth-based source budget (4 / 8 / 12).
- **SSRF guard:** https-only, host allowlist, default port, no embedded credentials, and rejection
  of private ranges, IP literals and the cloud metadata endpoint.
- **Gemini client over REST:** JSON-schema structured output, bounded jittered retries for
  429/5xx, per-call timeout, schema validation, and no key in the URL.
- **Deterministic mock provider** so tests, CI and offline demos never need a secret.
- **Streaming API** at `POST /api/research` with Zod validation, 4 KiB body cap, per-IP fixed
  window rate limiting, and a 15-minute LRU+TTL report cache.
- **Report UI:** agent timeline, verdict badge, `role="meter"` confidence, claim-by-claim evidence
  with quotes and resolvable links, conflicting-evidence panel, limitations, next steps, and
  Markdown copy/download.
- **Accessibility:** WCAG 2.2 AA target — skip link, landmarks, focus transfer to the report,
  `aria-live` progress, reduced-motion and forced-colors support.
- **Security headers and nonce-based CSP** generated per request in `src/proxy.ts`.
- **Health endpoint** at `GET /api/health` that reports provider and region without leaking
  secrets.
- **Tests and CI:** 105 Vitest unit/component tests with coverage gates, Playwright end-to-end
  specs, axe scans, ESLint zero-warning policy, CodeQL and Dependabot.
- **Deployment:** multi-stage non-root Dockerfile, Cloud Build pipeline, one-command Cloud Run
  script with Secret Manager, and a Render blueprint fallback.

### Fixed

- Upgraded Next.js to 16.4.6 to address CVE-2025-66478 in 15.5.4.
- Migrated the deprecated `middleware` convention to `proxy` for Next.js 16.
- Rendered the home route per request so the per-response CSP nonce matches the script tags.
  A prerendered page shipped build-time scripts with no nonce, which blocked hydration while
  still looking correct in a screenshot.
- End-to-end specs now use `localhost` (not `127.0.0.1`), because Next.js dev treats the latter as
  a cross-origin dev request and refuses its own resources.
- The browser suite now runs against the production build with `RATE_LIMIT_MAX=100`, and the
  short-input assertion scopes its `role="alert"` lookup so Next.js's route announcer no longer
  causes a strict-mode match.

### Known limitations

- Retrieval is limited to encyclopaedia extracts, not primary literature.
- Confidence is a calibrated heuristic, not a statistical probability.
- The in-memory cache and rate limiter are per instance; use Redis/Memorystore for global limits.

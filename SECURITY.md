# Security policy and threat model

## Reporting

This is a hackathon project, but it is written to production standards. Report issues privately to
the maintainer rather than opening a public issue. Expect an acknowledgement within 48 hours.

## Threat model

| # | Threat | Control | Where |
| --- | --- | --- | --- |
| 1 | SSRF into private network / cloud metadata | HTTPS-only, host allowlist, no credentials in URL, default port only, private-range and IP-literal rejection | `src/lib/security/url-guard.ts` |
| 2 | Prompt injection via retrieved pages | Retrieved text wrapped in `<untrusted_source>` delimiters; closing tag stripped; system prompt states the hierarchy | `src/lib/security/sanitize.ts`, `src/lib/agents/prompts.ts` |
| 3 | XSS via model or source text | No `dangerouslySetInnerHTML`, no markdown-to-HTML on untrusted text, React escaping, tag stripping as defence in depth | `src/components/*` |
| 4 | Script injection through a weak CSP | Per-request nonce, `strict-dynamic`, no `unsafe-inline` for scripts in production, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` | `src/proxy.ts` |
| 5 | Secret leakage to the client | Gemini calls only in route handlers; key read from env; redacted logger; Secret Manager in production | `src/lib/ai/gemini.ts`, `src/lib/logger.ts` |
| 6 | API abuse / cost exhaustion | Per-IP fixed window (8/min), 4 KiB body cap, per-run timeout, depth-capped work | `src/app/api/research/route.ts` |
| 7 | Oversized or malformed input | Zod `.strict()`, 8–600 chars, control characters stripped, 413 on large bodies | `src/lib/schemas.ts` |
| 8 | Hallucinated citations | Citations checked against the retrieved source set; unsupported claims downgraded | `src/lib/agents/verifier.ts` |
| 9 | Provider error leaking internals | Typed `AppError` → safe message; details only in server logs | `src/lib/errors.ts` |
| 10 | Clickjacking / MIME sniffing | `X-Frame-Options: DENY`, `nosniff`, CORP/COOP, HSTS | `next.config.ts` |
| 11 | Dependency compromise | Lockfile, `npm ci`, Dependabot, CodeQL, minimal dependency surface (no UI kit, no model SDK) | `.github/` |
| 12 | Container escape / root | Multi-stage image, non-root `nextjs` user, no build tools in the runtime layer | `Dockerfile` |

## Deliberate non-goals

- **Authentication.** Every run is ephemeral and holds no personal data. Adding accounts would add
  attack surface without helping the problem statement.
- **Arbitrary URL fetching.** Users cannot supply sources; that is the point of the allowlist.
- **Long-term storage.** Reports live in the browser for the session. Nothing is persisted
  server-side beyond a 15-minute in-memory cache.

## Operated controls

- `npm audit` and CodeQL run in CI.
- Security headers verified by integration smoke test.
- Secrets are never logged; the logger redacts keys matching `api_key|token|secret|password|cookie`.
- Rate-limit state is bounded (max 10k keys) to prevent memory exhaustion.

## Hardening checklist for a public deployment

- [ ] `GEMINI_API_KEY` stored in Secret Manager, not env plaintext
- [ ] Cloud Run service account has only `secretmanager.secretAccessor`
- [ ] Budget alert configured
- [ ] `max-instances` capped (3 by default)
- [ ] Log retention set to 30 days

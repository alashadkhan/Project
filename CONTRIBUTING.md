# Contributing

Veritas is a solo hackathon build, but it is written as if it will be maintained. If you want to
extend it, follow the same rules the codebase already follows.

## Setup

```bash
npm install
npm run dev       # http://localhost:3000, deterministic mock provider, no key needed
```

To work against the real model and real sources, copy `.env.example` to `.env.local` and set
`AI_PROVIDER=gemini` plus `GEMINI_API_KEY`.

## Before opening a pull request

```bash
npm run verify    # lint + typecheck + coverage gates + production build
npm run test:e2e  # Playwright + axe (first run downloads Chromium)
```

All four must pass. CI runs the same commands, so a red pipeline is a blocked merge.

## Ground rules

1. **The verdict stays deterministic.** `src/lib/agents/verdict.ts` is a pure function with unit
   tests. A model must never decide the verdict or the confidence. If you want to change the
   scoring, change the formula, the tests, and `docs/SCORING.md` together.
2. **No citation, no claim.** Citations must resolve to a retrieved source id. Unsupported claims
   are downgraded to `unclear`.
3. **Untrusted in, untrusted out.** Retrieval text is data, never instructions. Pass it through
   `asUntrusted` / `safeText`; never render it as HTML.
4. **Validate at the boundary.** Every external input — request body, model output, URL — goes
   through Zod or an explicit guard.
5. **No new runtime dependency without a reason.** Prefer the standard library. A dependency must
   justify its attack surface in the pull request description.
6. **Accessibility is a correctness property.** New UI needs a role, an accessible name, keyboard
   support and a visible focus state. Do not remove `role="meter"`, live regions, or the skip link.
7. **No secrets in code, fixtures, logs or tests.** Use the mock provider in tests.

## Style

- TypeScript strict, no `any`, no non-null assertions unless the invariant is documented.
- Comments explain *why*, not *what*.
- Tests are named after the behaviour they protect.
- Keep components small and server-first; add `"use client"` only where interaction requires it.

## Reporting bugs

Open an issue with the claim used, the depth, the expected verdict and the observed one. Do not
include API keys, tokens or personal data in logs you paste.

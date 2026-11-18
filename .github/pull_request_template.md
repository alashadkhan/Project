## What changed

<!-- One or two sentences. Link the issue if there is one. -->

## Why

<!-- The behaviour or risk this addresses. -->

## Checklist

- [ ] `npm run verify` passes (lint, typecheck, coverage gates, build)
- [ ] `npm run test:e2e` passes (or the change does not touch the UI)
- [ ] New behaviour has a test that fails without this change
- [ ] The verdict stays deterministic (`src/lib/agents/verdict.ts` untouched, or formula + tests + `docs/SCORING.md` updated together)
- [ ] Untrusted text still passes through `safeText` / `asUntrusted`
- [ ] No secret, key or personal data in code, fixtures, logs or screenshots
- [ ] Accessibility kept: roles, accessible names, keyboard path, visible focus

## Screenshots

<!-- For UI changes: before and after. Drag images in; they are cheaper to review than prose. -->

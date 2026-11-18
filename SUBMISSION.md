# Submission sheet — PromptWars x Agent X 2.0

Everything in this file is a value to paste, or a step that takes a few minutes. The code, tests,
docs and deploy config are finished; the three links below are the only things that need your
accounts.

**Deadline:** 20 Nov 2026, 11:00 PM IST · **Attempts:** 0 of 2 used · Submit once, keep the second
attempt in reserve.

---

## 1. Fields to fill

| Field | Value |
| --- | --- |
| Challenge | **PS03 — Multi-Agent Research & Fact-Checking** |
| GitHub repository | `https://github.com/alashadkhan/Project` |
| Deployed link (Cloud run URL) | printed by `bash scripts/deploy-cloudrun.sh`, e.g. `https://veritas-xxxxx-el.a.run.app` |
| LinkedIn post | `https://www.linkedin.com/posts/<your-handle>_...` (open your post → ⋯ → Copy link) |

The repository is **`alashadkhan/Project`**. The npm package name stays `veritas-agent`
(`package.json`), and the Cloud Run service is named `veritas` (`cloudbuild.yaml`,
`scripts/deploy-cloudrun.sh`), which is why the deployed URL contains `veritas`.

---

## 2. Publish to GitHub (~4 minutes)

From the `veritas` folder:

```bash
git init -b main
git add .
git commit -m "feat: Veritas — multi-agent fact-checking with a deterministic verdict"
git remote add origin https://github.com/alashadkhan/Project.git
git push -u origin main
```

Create the empty repository first at <https://github.com/new> — **no** README, .gitignore or
licence, or the push will be rejected. Then check that `node_modules/`, `.next/` and `.env*` were
**not** committed (`git ls-files | Select-String node_modules` should return nothing).

After the push, two workflows start on their own:

- **CI** — lint, typecheck, 105 tests with coverage gates, production build, then Playwright + axe.
- **CodeQL** — security and quality analysis.

Both must be green before you submit. The README loses nothing if they are still running, but a
judge clicking the Actions tab should not see a failure.

---

## 3. Deploy to Cloud Run (~6 minutes)

Full detail in [DEPLOY.md](DEPLOY.md); the short version, in
<https://shell.cloud.google.com>:

```bash
gcloud config set project YOUR_PROJECT_ID
unzip veritas.zip -d veritas && cd veritas
bash scripts/deploy-cloudrun.sh
```

The script enables the APIs, asks for your Gemini key once
(<https://aistudio.google.com/apikey>), stores it in Secret Manager, builds the image and deploys.
It prints the public URL.

Then verify — this is the check that separates a real deployment from a mock:

```bash
curl -s "YOUR_URL/api/health"
# {"status":"ok","provider":"gemini",...}
```

Run one claim in the browser and open a citation. If `provider` says `mock`, the
`AI_PROVIDER=gemini` env var did not apply; re-run the script.

Optional: paste the URL line the script prints into the top of `README.md`, then commit and push.

---

## 4. LinkedIn post (copy, paste, publish)

> I built Veritas for PromptWars x Agent X 2.0 — a multi-agent fact-checker that shows its receipts.
>
> Ask it whether octopuses have three hearts. A planner breaks the claim into research questions, a
> retriever pulls allowlisted sources, a verifier labels every assertion as supports, refutes or
> mixed with an exact quote, and a synthesizer writes the report.
>
> The part I am proudest of: the verdict is not a model opinion. It is a deterministic function
> over weighted stances — support mass minus refute mass, with a minimum evidence floor. If the
> evidence is thin it answers “insufficient evidence” instead of guessing, and every percentage can
> be recomputed by hand.
>
> Under the hood: Next.js 16, TypeScript strict, Gemini 3.8 Flash with structured output, Cloud
> Run and Secret Manager. 105 tests with coverage gates, Playwright and axe for accessibility,
> CodeQL for security, and an SSRF guard so retrieval can never reach a private network.
>
> Thank you Google for Developers and Hack2Skill for the challenge.
>
> Try it: YOUR_DEPLOYED_URL
> Code: https://github.com/alashadkhan/Project
>
> #PromptWars #AgentX #GoogleCloud #Gemini #BuildWithAI

Paste both links before publishing. Tags are already in the text; optionally @-mention
**Google for Developers** and **Hack2Skill** for reach.

---

## 5. Pre-submit checklist

- [ ] `npm run verify` passes locally (lint, typecheck, coverage, build)
- [ ] Repo is **public** and opens in a logged-out browser
- [ ] `README.md` renders the architecture diagram and rubric table
- [ ] `/api/health` returns `provider: "gemini"` on the deployed URL
- [ ] A real claim runs end to end on the deployed URL and a citation opens
- [ ] GitHub Actions: CI and CodeQL green
- [ ] LinkedIn post is public (not “connections only”) and contains both links
- [ ] Deployed URL and repo URL are in the submission form
- [ ] Screenshot the confirmation page — it is your only proof if a score is disputed

---

## 6. What to say if asked “what is novel here?”

Three claims a judge can verify in under a minute:

1. **The verdict is code, not vibes.** `src/lib/agents/verdict.ts` is a pure function with 10 tests;
   `docs/SCORING.md` gives a worked example a judge can recompute.
2. **Citation integrity is enforced, not requested.** Unknown source ids are dropped and
   unsupported assertions are downgraded to `unclear` (`src/lib/agents/verifier.ts`).
3. **The security boundary is explicit.** HTTPS-only allowlist, private-range rejection, prompt
   injection delimiters, nonce CSP, per-IP limits, Secret Manager — each mapped to a threat in
   `SECURITY.md`.

## 7. Honest limitations (say these before a judge finds them)

- Retrieval is Wikipedia extracts, not primary literature; sources are linked for follow-up.
- Confidence is a calibrated heuristic over evidence volume and agreement, not a probability.
- Cache and rate limits are per Cloud Run instance, so they are soft at scale.
- English-only corpus by default.

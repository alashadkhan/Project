# How Veritas is scored (and why you can trust it)

This document exists so a judge, a user, or a future maintainer can recompute a verdict without
reading the whole codebase.

## 1. Stance per assertion

The Verifier produces 1–8 assertions. Each has:

- `text` — one atomic factual statement derived from the claim
- `stance` — `supports`, `refutes`, `mixed`, `unclear`
- `confidence` — 0..1, judged from evidence quality
- `evidence[]` — at least one `{sourceId, quote}` when the stance is not `unclear`

Server-side post-processing:

- citations to source ids that were not retrieved are removed;
- a claim with no surviving citation becomes `unclear` and its confidence is capped at 0.3;
- duplicates are removed; confidence is clamped to `[0, 1]`.

## 2. Verdict

Let `w_i` be the confidence of claim `i`.

```text
supportMass  = Σ w_i where stance = supports
refuteMass   = Σ w_i where stance = refutes
mixedMass    = Σ w_i where stance = mixed, divided by 2
evidenceMass = supportMass + refuteMass + mixedMass
net          = (supportMass − refuteMass) / evidenceMass
```

| Condition | Verdict |
| --- | --- |
| `evidenceMass < 0.75` or no claims | `insufficient_evidence` |
| `net ≥ +0.40` | `supported` |
| `net ≤ −0.40` | `contradicted` |
| otherwise | `mixed` |

## 3. Confidence

```text
volume      = evidenceMass / (evidenceMass + 2)
consistency = |net|
coverage    = min(1, distinct cited sources / 3)
confidence  = clamp(0.15 + 0.55·volume + 0.20·consistency + 0.10·coverage, 0, 0.98)
```

For `insufficient_evidence`, confidence is capped at 0.35 instead, so a thin run can never look
authoritative.

### Worked example

Two supporting claims at 0.9 and 0.8, cited from three sources:

```text
supportMass = 1.7   refuteMass = 0   evidenceMass = 1.7
net = 1.0 → supported
volume = 1.7 / 3.7 = 0.459
consistency = 1.0
coverage = 1.0
confidence = 0.15 + 0.252 + 0.20 + 0.10 = 0.702
```

## 4. What the model is *not* allowed to decide

- the verdict (deterministic function)
- the confidence (deterministic function)
- source ids (assigned by the retriever)
- citations to sources it was not given (dropped)
- the report id or timestamps (server-side)

This separation is the core design claim: **language models extract and explain; a testable
function decides.** It also limits the damage of a prompt-injected or hallucinating model.

## 5. Limits of the score

The score measures agreement and evidence volume, not truth. A claim can be `supported` by an
outdated encyclopaedia. That is why every claim links to its source, limitations are always
shown, and the UI never presents the verdict as a final answer.

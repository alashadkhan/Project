import type { LlmRequest } from "@/lib/ai/types";

/**
 * Deterministic, dependency-free model used by tests, CI and offline demos.
 *
 * It is intentionally *not* an emulation of a language model: it returns
 * well-formed fixtures so the surrounding orchestration, validation, scoring
 * and UI can be exercised without a network call or API key.
 */
export class MockLlm {
  readonly model = "mock-veritas-1";

  async generate<T>(request: LlmRequest<T>): Promise<T> {
    const claim = typeof request.context.claim === "string" ? request.context.claim : "the claim";
    const sourceIds = Array.isArray(request.context.sourceIds)
      ? (request.context.sourceIds as string[])
      : ["S1"];

    if (request.task === "plan") {
      const count = Number(request.context.questionCount ?? 3);
      const pool = [
        `What is the factual basis for: ${claim}?`,
        `Which authoritative sources discuss: ${claim}?`,
        `Are there credible counter-arguments to: ${claim}?`,
        `How recent is the evidence about: ${claim}?`,
        `What context changes the meaning of: ${claim}?`,
      ];
      return request.parse({
        questions: pool.slice(0, count).map((question) => ({ question })),
      });
    }

    if (request.task === "verify") {
      const primary = sourceIds[0] ?? "S1";
      const secondary = sourceIds[1] ?? primary;
      return request.parse({
        claims: [
          {
            text: truncate(`The core assertion in "${claim}" is corroborated by reference material.`),
            stance: "supports",
            confidence: 0.82,
            rationale: "The retrieved reference entry states the same relationship directly.",
            evidence: [{ sourceId: primary, quote: "Reference material describes the same relationship." }],
          },
          {
            text: truncate(`Secondary details around "${claim}" are only partially supported.`),
            stance: "mixed",
            confidence: 0.54,
            rationale: "The second source adds context but does not confirm the stronger wording.",
            evidence: [{ sourceId: secondary, quote: "Additional context without a direct confirmation." }],
          },
        ],
        conflicts:
          sourceIds.length > 2
            ? [
                {
                  topic: "Emphasis of the claim",
                  description: "Sources describe the same fact with different strength of wording.",
                  claimIds: ["C1", "C2"],
                  sourceIds: [primary, secondary],
                },
              ]
            : [],
      });
    }

    return request.parse({
      summary: truncate(
        `The available evidence leans toward supporting the central assertion about "${claim}". Confidence is moderate because the corpus is small and extracts are short. Read the claim-by-claim breakdown before acting on it.`,
      ),
      limitations: [
        "Only reference encyclopaedia extracts were retrieved, not primary literature.",
        "Short extracts can omit important context or caveats.",
      ],
      nextSteps: [
        "Check the cited primary sources for the full context.",
        "Re-run with a narrower claim to raise evidence quality.",
      ],
    });
  }
}

function truncate(value: string): string {
  return value.length > 380 ? `${value.slice(0, 377)}...` : value;
}

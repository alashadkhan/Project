import { z } from "zod";

import { DEPTHS } from "@/lib/types";

/**
 * Input validation happens at the trust boundary (the HTTP route).
 * `.strict()` rejects unknown keys instead of silently ignoring them, which
 * keeps the API contract explicit and prevents mass-assignment surprises.
 */
export const researchRequestSchema = z
  .object({
    claim: z
      .string()
      .transform((value) => value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim())
      .pipe(
        z
          .string()
          .min(8, "Give me at least 8 characters so there is something to check.")
          .max(600, "Keep the claim under 600 characters."),
      ),
    depth: z.enum(DEPTHS).default("standard"),
  })
  .strict();

export type ResearchRequestInput = z.infer<typeof researchRequestSchema>;

const stanceSchema = z.enum(["supports", "refutes", "mixed", "unclear"]);

/** Runtime validation for the Planner agent's structured output. */
export const plannerOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(8).max(240),
      }),
    )
    .min(2)
    .max(6),
});

export const verifierOutputSchema = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().min(8).max(400),
        stance: stanceSchema,
        confidence: z.number(),
        rationale: z.string().min(4).max(600),
        evidence: z
          .array(
            z.object({
              sourceId: z.string().min(1).max(12),
              quote: z.string().min(4).max(400),
            }),
          )
          .max(6)
          .default([]),
      }),
    )
    .min(1)
    .max(8),
  conflicts: z
    .array(
      z.object({
        topic: z.string().min(3).max(120),
        description: z.string().min(8).max(600),
        claimIds: z.array(z.string().min(1).max(12)).max(6).default([]),
        sourceIds: z.array(z.string().min(1).max(12)).max(6).default([]),
      }),
    )
    .max(5)
    .default([]),
});

export const synthesisOutputSchema = z.object({
  summary: z.string().min(20).max(1200),
  limitations: z.array(z.string().min(4).max(240)).min(1).max(5),
  nextSteps: z.array(z.string().min(4).max(240)).min(1).max(5),
});

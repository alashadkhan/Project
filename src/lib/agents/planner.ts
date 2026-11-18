import type { LlmClient } from "@/lib/ai/types";
import { parseWith } from "@/lib/ai/types";
import { plannerOutputSchema } from "@/lib/schemas";
import { plannerSystemPrompt, plannerUserPrompt } from "@/lib/agents/prompts";
import { safeText } from "@/lib/security/sanitize";
import type { Depth, SubQuestion } from "@/lib/types";

const QUESTION_COUNT: Record<Depth, number> = { quick: 2, standard: 3, deep: 5 };

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "OBJECT",
        properties: { question: { type: "STRING" } },
        required: ["question"],
      },
    },
  },
  required: ["questions"],
} as const;

/**
 * Planner agent: decomposes the claim into independent, searchable questions.
 * Question count scales with the requested depth, which keeps latency and cost
 * proportional to what the user asked for.
 */
export async function planResearch(input: {
  claim: string;
  depth: Depth;
  llm: LlmClient;
}): Promise<SubQuestion[]> {
  const questionCount = QUESTION_COUNT[input.depth];

  const output = await input.llm.generate({
    task: "plan",
    system: plannerSystemPrompt(),
    prompt: plannerUserPrompt(input.claim, questionCount),
    responseSchema: RESPONSE_SCHEMA,
    parse: parseWith(plannerOutputSchema),
    context: { claim: input.claim, questionCount },
    temperature: 0.3,
    maxOutputTokens: 700,
  });

  return output.questions.slice(0, questionCount).map((question, index) => ({
    id: `Q${index + 1}`,
    question: safeText(question.question, 240),
  }));
}

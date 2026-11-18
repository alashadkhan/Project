import { describe, expect, it } from "vitest";

import { MockLlm } from "@/lib/ai/mock";
import { planResearch } from "@/lib/agents/planner";
import { parseWith } from "@/lib/ai/types";
import { plannerOutputSchema } from "@/lib/schemas";

const llm = new MockLlm();

describe("planResearch", () => {
  it.each([
    ["quick", 2],
    ["standard", 3],
    ["deep", 5],
  ] as const)("asks for %s depth and returns %i questions", async (depth, expected) => {
    const questions = await planResearch({ claim: "Octopuses have three hearts.", depth, llm });
    expect(questions).toHaveLength(expected);
  });

  it("assigns stable ids", async () => {
    const questions = await planResearch({ claim: "A testable claim about the world.", depth: "standard", llm });
    expect(questions.map((question) => question.id)).toEqual(["Q1", "Q2", "Q3"]);
  });

  it("sanitises question text", async () => {
    const questions = await planResearch({ claim: "A testable claim about the world.", depth: "quick", llm });
    for (const question of questions) {
      expect(question.question).not.toMatch(/<[^>]+>/);
      expect(question.question.length).toBeGreaterThan(10);
    }
  });

  it("rejects malformed planner output at the schema boundary", () => {
    const schema = plannerOutputSchema;
    expect(() => schema.parse({ questions: [] })).toThrow();
    expect(() => schema.parse({ questions: [{ question: "hi" }] })).toThrow();
  });

  it("exposes a parser helper that validates", () => {
    const parse = parseWith(plannerOutputSchema);
    expect(parse({ questions: [{ question: "What is the evidence?" }, { question: "What else?" }] })).toBeTruthy();
  });
});

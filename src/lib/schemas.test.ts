import { describe, expect, it } from "vitest";

import { researchRequestSchema } from "@/lib/schemas";

describe("researchRequestSchema", () => {
  it("accepts a valid request and defaults depth", () => {
    const parsed = researchRequestSchema.parse({ claim: "  The sky is blue today. " });
    expect(parsed.claim).toBe("The sky is blue today.");
    expect(parsed.depth).toBe("standard");
  });

  it("strips control characters", () => {
    const parsed = researchRequestSchema.parse({ claim: "Hello\u0000 world\u0007 now." });
    expect(parsed.claim).toBe("Hello world now.");
  });

  it("rejects short claims", () => {
    expect(() => researchRequestSchema.parse({ claim: "short" })).toThrow(/8 characters/);
  });

  it("rejects overly long claims", () => {
    expect(() => researchRequestSchema.parse({ claim: "x".repeat(601) })).toThrow(/600/);
  });

  it("rejects unknown keys instead of ignoring them", () => {
    expect(() =>
      researchRequestSchema.parse({ claim: "A valid claim here", admin: true }),
    ).toThrow();
  });

  it("rejects unknown depth values", () => {
    expect(() =>
      researchRequestSchema.parse({ claim: "A valid claim here", depth: "infinite" }),
    ).toThrow();
  });
});

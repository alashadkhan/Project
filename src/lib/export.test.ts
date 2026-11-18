import { describe, expect, it } from "vitest";

import { reportToMarkdown } from "@/lib/export";
import { makeReport } from "@/test/fixtures";

describe("reportToMarkdown", () => {
  it("includes every major section", () => {
    const markdown = reportToMarkdown(makeReport());

    expect(markdown).toContain("# Verification report");
    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("## Claim-by-claim");
    expect(markdown).toContain("## Sources");
    expect(markdown).toContain("## Limitations");
    expect(markdown).toContain("## Next steps");
  });

  it("includes verdict and confidence", () => {
    const markdown = reportToMarkdown(makeReport());
    expect(markdown).toContain("**Verdict:** Supported");
    expect(markdown).toContain("**Confidence:** 72%");
  });

  it("includes source urls so citations survive export", () => {
    const markdown = reportToMarkdown(makeReport());
    expect(markdown).toContain("https://en.wikipedia.org/wiki/Octopus");
  });

  it("renders conflicting evidence only when present", () => {
    expect(reportToMarkdown(makeReport())).not.toContain("## Conflicting evidence");
    const withConflict = makeReport({
      conflicts: [
        {
          id: "X1",
          topic: "Heart count",
          description: "Sources differ on the count.",
          claimIds: ["C1"],
          sourceIds: ["S1"],
        },
      ],
    });
    expect(reportToMarkdown(withConflict)).toContain("## Conflicting evidence");
  });

  it("escapes markdown control characters in user content", () => {
    const report = makeReport({ claim: "[click](javascript:alert(1))" });
    const markdown = reportToMarkdown(report);
    expect(markdown).toContain("\\[click\\]");
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  MockSearchClient,
  retrieveSources,
  type SearchClient,
  type SearchHit,
} from "@/lib/search/retriever";

const ALLOWED = ["en.wikipedia.org"];
const now = () => Date.parse("2026-11-18T12:00:00.000Z");

const questions = [
  { id: "Q1", question: "first question" },
  { id: "Q2", question: "second question" },
];

function hit(title: string, slug: string): SearchHit {
  return {
    title,
    url: `https://en.wikipedia.org/wiki/${slug}`,
    snippet: `A sufficiently long encyclopaedia extract about ${title} that clears the minimum length filter.`,
  };
}

describe("retrieveSources", () => {
  it("deduplicates by URL and assigns sequential ids", async () => {
    const search: SearchClient = {
      name: "fake",
      search: async () => [hit("A", "A"), hit("A", "A"), hit("B", "B")],
    };

    const sources = await retrieveSources({
      questions,
      depth: "standard",
      search,
      allowedHosts: ALLOWED,
      now,
    });

    expect(sources).toHaveLength(2);
    expect(sources.map((source) => source.id)).toEqual(["S1", "S2"]);
    expect(sources[0]?.retrievedAt).toBe("2026-11-18T12:00:00.000Z");
  });

  it("drops URLs outside the allowlist", async () => {
    const search: SearchClient = {
      name: "fake",
      search: async () => [
        hit("Good", "Good"),
        { title: "Bad", url: "https://evil.example.com/x", snippet: "x".repeat(80) },
      ],
    };

    const sources = await retrieveSources({
      questions,
      depth: "standard",
      search,
      allowedHosts: ALLOWED,
      now,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0]?.url).toContain("en.wikipedia.org");
  });

  it("caps the number of sources by depth", async () => {
    const search: SearchClient = {
      name: "fake",
      search: async () => Array.from({ length: 6 }, (_, index) => hit(`T${index}`, `T${index}`)),
    };

    const quick = await retrieveSources({ questions, depth: "quick", search, allowedHosts: ALLOWED, now });
    const deep = await retrieveSources({ questions, depth: "deep", search, allowedHosts: ALLOWED, now });

    expect(quick.length).toBeLessThanOrEqual(4);
    expect(deep.length).toBeLessThanOrEqual(12);
    expect(deep.length).toBeGreaterThanOrEqual(quick.length);
  });

  it("tolerates one query failing", async () => {
    let call = 0;
    const search: SearchClient = {
      name: "fake",
      search: async () => {
        call += 1;
        if (call === 1) throw new Error("boom");
        return [hit("A", "A")];
      },
    };

    const sources = await retrieveSources({
      questions,
      depth: "standard",
      search,
      allowedHosts: ALLOWED,
      now,
    });

    expect(sources).toHaveLength(1);
  });

  it("labels wikipedia sources as medium reliability", async () => {
    const sources = await retrieveSources({
      questions,
      depth: "quick",
      search: new MockSearchClient(),
      allowedHosts: ALLOWED,
      now,
    });

    expect(sources[0]?.reliability).toBe("medium");
    expect(sources[0]?.publisher).toBe("En");
  });

  it("sanitises source text", async () => {
    const search: SearchClient = {
      name: "fake",
      search: async () => [
        {
          title: "<b>Title</b>",
          url: "https://en.wikipedia.org/wiki/X",
          snippet: `<script>alert(1)</script>${"y".repeat(60)}`,
        },
      ],
    };

    const [source] = await retrieveSources({
      questions,
      depth: "quick",
      search,
      allowedHosts: ALLOWED,
      now,
    });

    expect(source?.title).not.toContain("<b>");
    expect(source?.snippet).not.toContain("<script>");
  });

  it("returns an empty list when every query fails", async () => {
    const search: SearchClient = {
      name: "fake",
      search: vi.fn().mockRejectedValue(new Error("offline")),
    };

    await expect(
      retrieveSources({ questions, depth: "quick", search, allowedHosts: ALLOWED, now }),
    ).resolves.toEqual([]);
  });
});

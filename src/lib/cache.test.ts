import { describe, expect, it } from "vitest";

import { TtlCache } from "@/lib/cache";

describe("TtlCache", () => {
  it("returns stored values", () => {
    const cache = new TtlCache<string, number>();
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("expires entries after the ttl", () => {
    let now = 0;
    const cache = new TtlCache<string, number>({ ttlMs: 100, now: () => now });
    cache.set("a", 1);
    now = 99;
    expect(cache.get("a")).toBe(1);
    now = 101;
    expect(cache.get("a")).toBeUndefined();
  });

  it("evicts the least recently used entry", () => {
    const cache = new TtlCache<string, number>({ maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // refresh recency of a
    cache.set("c", 3);

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
    expect(cache.stats().evictions).toBe(1);
  });

  it("tracks hit and miss statistics", () => {
    const cache = new TtlCache<string, number>();
    cache.set("a", 1);
    cache.get("a");
    cache.get("missing");
    expect(cache.stats()).toMatchObject({ hits: 1, misses: 1 });
  });

  it("supports deletion and clearing", () => {
    const cache = new TtlCache<string, number>();
    cache.set("a", 1);
    expect(cache.delete("a")).toBe(true);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("purges expired entries from size", () => {
    let now = 0;
    const cache = new TtlCache<string, number>({ ttlMs: 10, now: () => now });
    cache.set("a", 1);
    now = 20;
    expect(cache.size).toBe(0);
  });

  it("reports presence without masking expiry", () => {
    let now = 0;
    const cache = new TtlCache<string, number>({ ttlMs: 10, now: () => now });
    cache.set("a", 1);
    expect(cache.has("a")).toBe(true);
    now = 11;
    expect(cache.has("a")).toBe(false);
  });
});

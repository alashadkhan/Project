import { describe, expect, it } from "vitest";

import { FixedWindowRateLimiter } from "@/lib/security/rate-limit";

describe("FixedWindowRateLimiter", () => {
  it("allows requests up to the limit", () => {
    const limiter = new FixedWindowRateLimiter({ max: 2, windowMs: 1000 });
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(false);
  });

  it("reports the remaining budget", () => {
    const limiter = new FixedWindowRateLimiter({ max: 3, windowMs: 1000 });
    expect(limiter.check("ip").remaining).toBe(2);
    expect(limiter.check("ip").remaining).toBe(1);
  });

  it("isolates keys", () => {
    const limiter = new FixedWindowRateLimiter({ max: 1, windowMs: 1000 });
    limiter.check("a");
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter({ max: 1, windowMs: 100, now: () => now });
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(false);
    now = 101;
    expect(limiter.check("ip").allowed).toBe(true);
  });

  it("returns a sensible retry delay", () => {
    const now = 5_000;
    const limiter = new FixedWindowRateLimiter({ max: 1, windowMs: 60_000, now: () => now });
    limiter.check("ip");
    const blocked = limiter.check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(50);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("caps memory by dropping the oldest keys under pressure", () => {
    const limiter = new FixedWindowRateLimiter({ max: 1, windowMs: 1000, maxKeys: 16 });
    for (let index = 0; index < 40; index += 1) limiter.check(`ip-${index}`);
    expect(limiter.size).toBeLessThanOrEqual(16);
  });

  it("can be reset", () => {
    const limiter = new FixedWindowRateLimiter({ max: 1, windowMs: 1000 });
    limiter.check("ip");
    limiter.reset();
    expect(limiter.check("ip").allowed).toBe(true);
  });
});

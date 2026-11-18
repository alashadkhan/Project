export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  max: number;
  windowMs: number;
  now?: () => number;
  /** Guards against unbounded memory if many distinct clients appear. */
  maxKeys?: number;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window counter. Simple, predictable and adequate for a single
 * Cloud Run instance. For multi-instance deployments, swap the store for
 * Memorystore/Redis while keeping this interface.
 */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly max: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly maxKeys: number;

  constructor(options: RateLimiterOptions) {
    this.max = Math.max(1, options.max);
    this.windowMs = Math.max(1, options.windowMs);
    this.now = options.now ?? Date.now;
    this.maxKeys = Math.max(16, options.maxKeys ?? 10_000);
  }

  check(key: string): RateLimitResult {
    const now = this.now();
    this.prune(now);

    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }

    window.count += 1;
    const allowed = window.count <= this.max;
    const retryAfterSeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));

    return {
      allowed,
      remaining: Math.max(0, this.max - window.count),
      resetAt: window.resetAt,
      retryAfterSeconds,
    };
  }

  reset(): void {
    this.windows.clear();
  }

  get size(): number {
    return this.windows.size;
  }

  private prune(now: number): void {
    if (this.windows.size < this.maxKeys) {
      for (const [key, window] of this.windows) {
        if (window.resetAt <= now) this.windows.delete(key);
      }
      return;
    }
    // Under pressure, drop expired entries, then the oldest insertion.
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next();
      if (oldest.done) break;
      this.windows.delete(oldest.value);
    }
  }
}

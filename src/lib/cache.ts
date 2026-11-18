export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

export interface CacheOptions {
  maxEntries?: number;
  ttlMs?: number;
  now?: () => number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Small LRU + TTL cache.
 *
 * Deliberately dependency-free: a handful of research runs does not justify a
 * Redis cluster, and Cloud Run keeps one instance warm per request burst.
 * The interface is narrow enough to swap for Memorystore later.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, Entry<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: CacheOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 200);
    this.ttlMs = Math.max(1, options.ttlMs ?? 10 * 60 * 1000);
    this.now = options.now ?? Date.now;
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      this.misses += 1;
      return undefined;
    }
    // Refresh recency (Map preserves insertion order).
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    this.evictIfNeeded();
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    this.purgeExpired();
    return this.entries.size;
  }

  stats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.entries.size,
    };
  }

  private evictIfNeeded(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
      this.evictions += 1;
    }
  }

  private purgeExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}

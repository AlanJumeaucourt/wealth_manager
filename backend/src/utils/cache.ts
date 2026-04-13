/**
 * In-memory TTL cache with optional max size (evicts oldest first).
 * Uses Map insertion order for O(1) eviction when maxKeys is set.
 * Used for currency rates and market data to avoid repeated API calls.
 */

export interface CacheOptions {
  /** Max entries; evicts oldest when exceeded. Default: no limit. */
  maxKeys?: number;
  /** Default TTL in ms. Overridable per set(). */
  ttlMs?: number;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export function createCache<T = unknown>(
  options: CacheOptions = {},
): {
  get(key: string): T | undefined;
  set(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
} {
  const { maxKeys = 0, ttlMs: defaultTtl = 5 * 60 * 1000 } = options;
  const store = new Map<string, Entry<T>>();

  function evictOne(): void {
    if (maxKeys <= 0 || store.size < maxKeys) return;
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
  }

  return {
    get(key: string): T | undefined {
      const e = store.get(key);
      if (!e) return undefined;
      if (Date.now() > e.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return e.value;
    },

    set(key: string, value: T, ttlMs?: number): void {
      const ttl = ttlMs ?? defaultTtl;
      const now = Date.now();
      if (store.has(key)) {
        store.delete(key);
      } else {
        evictOne();
      }
      store.set(key, {
        value,
        expiresAt: now + ttl,
        createdAt: now,
      });
    },

    delete(key: string): void {
      store.delete(key);
    },

    clear(): void {
      store.clear();
    },
  };
}

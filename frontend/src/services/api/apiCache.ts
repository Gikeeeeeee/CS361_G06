interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const apiCache = new Map<string, CacheEntry<any>>();

// Configurable TTL (Time-To-Live) defaults to 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

export const ApiCache = {
  get<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
    const entry = apiCache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > ttl;
    if (isExpired) {
      apiCache.delete(key);
      return null;
    }

    return entry.data as T;
  },

  set<T>(key: string, data: T): void {
    apiCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  },

  invalidate(keyPattern: string | RegExp): void {
    for (const key of apiCache.keys()) {
      if (typeof keyPattern === 'string' && key.includes(keyPattern)) {
        apiCache.delete(key);
      } else if (keyPattern instanceof RegExp && keyPattern.test(key)) {
        apiCache.delete(key);
      }
    }
  },

  clearAll(): void {
    apiCache.clear();
  },
};

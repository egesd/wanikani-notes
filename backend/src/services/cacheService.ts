const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes

const store = new Map<string, { data: unknown; expires: number }>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttlMs = DEFAULT_TTL): void {
  store.set(key, { data, expires: Date.now() + ttlMs });
}

export function cacheClear(): void {
  store.clear();
}

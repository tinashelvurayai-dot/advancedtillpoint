// Offline-tolerant query helper.
// Every successful backend read is mirrored to localStorage so a page still
// shows the last known data when the device is offline or the request fails.
// Without this a supplier (or product, stock row, expense...) saved a moment
// ago looks "lost" simply because the list could not be fetched again.

const PREFIX = "tillpoint.cache.";

export function readCache<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    /* quota exceeded - the cache is best effort only */
  }
}

/**
 * Spread into `useQuery`. Serves the last cached result while loading and
 * falls back to it when the network read fails.
 */
export function cachedQuery<T>(key: string, fetcher: () => Promise<T>) {
  return {
    queryFn: async (): Promise<T> => {
      try {
        const data = await fetcher();
        writeCache(key, data);
        return data;
      } catch (e) {
        const cached = readCache<T>(key);
        if (cached !== undefined) return cached;
        throw e;
      }
    },
    placeholderData: () => readCache<T>(key),
  };
}

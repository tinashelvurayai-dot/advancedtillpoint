// Keeps every successful backend read on the device.
// A till often runs on a weak connection: when a list cannot be re-fetched the
// page must still show the last known data instead of looking empty, which
// made saved records (suppliers, products, expenses...) appear "lost".
import type { QueryClient } from "@tanstack/react-query";

const KEY = "tillpoint.query-cache.v2";
const MAX_ENTRY_BYTES = 400_000;
const MAX_TOTAL_BYTES = 3_000_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;

type Stored = Array<{ k: string; d: unknown; t: number }>;

export function installQueryPersistence(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};

  // 1. Hydrate whatever the device already knows.
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw) as Stored;
      const now = Date.now();
      for (const entry of list) {
        if (now - entry.t > MAX_AGE_MS) continue;
        try {
          queryClient.setQueryData(JSON.parse(entry.k) as unknown[], entry.d);
        } catch {
          /* skip a malformed entry */
        }
      }
    }
  } catch {
    /* a broken cache must never block the app */
  }

  // 2. Mirror successful reads back to storage (debounced).
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    try {
      const now = Date.now();
      const out: Stored = [];
      let total = 0;
      for (const q of queryClient.getQueryCache().getAll()) {
        if (q.state.status !== "success" || q.state.data === undefined) continue;
        const entry = { k: JSON.stringify(q.queryKey), d: q.state.data, t: now };
        let size = 0;
        try {
          size = JSON.stringify(entry).length;
        } catch {
          continue; // non-serialisable data
        }
        if (size > MAX_ENTRY_BYTES || total + size > MAX_TOTAL_BYTES) continue;
        total += size;
        out.push(entry);
      }
      window.localStorage.setItem(KEY, JSON.stringify(out));
    } catch {
      /* quota or serialisation issue - best effort only */
    }
  };

  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 1_000);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

export function clearPersistedQueries(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

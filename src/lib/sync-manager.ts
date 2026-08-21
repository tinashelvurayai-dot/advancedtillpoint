// Global background sync: retries queued sales whenever the device is online.
import { flushQueue, getQueue, hydrateQueueFromIdb, subscribeQueue } from "@/lib/offline-queue";
import { hydrateLogFromIdb } from "@/lib/transaction-log";
import { requestPersistentStorage } from "@/lib/offline-db";

let started = false;
let syncing = false;
let timer: ReturnType<typeof setInterval> | undefined;

export type SyncState = { pending: number; syncing: boolean; lastSync: string | null };

let state: SyncState = { pending: 0, syncing: false, lastSync: null };
const listeners = new Set<(s: SyncState) => void>();

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(fn: (s: SyncState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

function emit(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const fn of listeners) {
    try {
      fn(state);
    } catch {
      /* noop */
    }
  }
}

export async function runSync(): Promise<{ ok: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return { ok: 0, failed: getQueue().length };
  if (syncing) return { ok: 0, failed: getQueue().length };
  if (getQueue().length === 0) {
    emit({ pending: 0 });
    return { ok: 0, failed: 0 };
  }
  syncing = true;
  emit({ syncing: true });
  try {
    const res = await flushQueue();
    emit({ syncing: false, pending: getQueue().length, lastSync: new Date().toISOString() });
    return res;
  } catch {
    emit({ syncing: false, pending: getQueue().length });
    return { ok: 0, failed: getQueue().length };
  } finally {
    syncing = false;
  }
}

/** Start listeners once, from the app root. */
export function startSyncManager() {
  if (started || typeof window === "undefined") return;
  started = true;
  void requestPersistentStorage();

  subscribeQueue((count) => emit({ pending: count }));
  void hydrateLogFromIdb();

  void hydrateQueueFromIdb().then((count) => {
    emit({ pending: count });
    void runSync();
  });

  window.addEventListener("online", () => {
    void runSync();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void runSync();
  });
  timer = setInterval(() => {
    void runSync();
  }, 30_000);

  // Ask the browser for a Background Sync wake-up where supported.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((reg) =>
        (
          reg as ServiceWorkerRegistration & { sync?: { register: (t: string) => Promise<void> } }
        ).sync?.register("tillpoint-sales"),
      )
      .catch(() => {
        /* noop */
      });
  }
}

export function stopSyncManager() {
  if (timer) clearInterval(timer);
  timer = undefined;
  started = false;
}

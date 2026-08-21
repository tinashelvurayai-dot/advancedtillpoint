// IndexedDB-backed durable storage for the offline till.
// localStorage stays as a synchronous mirror so the UI can read instantly,
// while IndexedDB is the durable store that survives storage pressure.
import { createStore, get, set, del } from "idb-keyval";

const store = typeof indexedDB !== "undefined" ? createStore("tillpoint", "kv") : undefined;

export const IDB_KEYS = {
  sales: "sales-queue",
  catalog: "catalog",
  syncedLog: "synced-sales",
} as const;

export async function idbGet<T>(key: string): Promise<T | undefined> {
  if (!store) return undefined;
  try {
    return (await get<T>(key, store)) ?? undefined;
  } catch {
    return undefined;
  }
}

const pendingWrites = new Map<string, Promise<void>>();

export function idbSet<T>(key: string, value: T): Promise<void> {
  if (!store) return Promise.resolve();
  const previous = pendingWrites.get(key) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => set(key, value, store))
    .catch(() => undefined);
  pendingWrites.set(key, next);
  return next;
}

export async function idbDel(key: string): Promise<void> {
  if (!store) return;
  try {
    await del(key, store);
  } catch {
    /* noop */
  }
}

/** Ask the browser to protect the till's offline data from eviction. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// Offline stock decrement. The cache keeps stock updates synchronous while
// localStorage and IndexedDB remain best-effort durable mirrors.
import { idbGet, idbSet } from "@/lib/offline-db";

const KEY = "tillpoint.stock-deltas.v1";
const IDB_KEY = "stock-deltas";

type DeltaMap = Record<string, Record<string, number>>;
type Listener = () => void;
const listeners = new Set<Listener>();

function readStorage(): DeltaMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DeltaMap) : {};
  } catch {
    return {};
  }
}

let deltaCache = readStorage();

function persist(map: DeltaMap) {
  deltaCache = map;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* best effort */
  }
  void idbSet(IDB_KEY, map);
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* noop */
    }
  }
}

export function subscribeStockDeltas(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function hydrateStockDeltas(): Promise<void> {
  if (Object.keys(deltaCache).length > 0) return;
  const durable = (await idbGet<DeltaMap>(IDB_KEY)) ?? {};
  if (Object.keys(durable).length > 0) persist(durable);
}

export function recordSaleDelta(
  saleId: string,
  items: Array<{ variant_id: string; quantity: number }>,
) {
  const entry: Record<string, number> = {};
  for (const i of items) entry[i.variant_id] = (entry[i.variant_id] ?? 0) + i.quantity;
  persist({ ...deltaCache, [saleId]: entry });
}

export function clearSaleDelta(saleId: string) {
  if (!(saleId in deltaCache)) return;
  const next = { ...deltaCache };
  delete next[saleId];
  persist(next);
}

export function pendingDeltas(): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const entry of Object.values(deltaCache)) {
    for (const [variantId, qty] of Object.entries(entry)) {
      totals[variantId] = (totals[variantId] ?? 0) + qty;
    }
  }
  return totals;
}

export function localQuantity(variantId: string, serverQuantity: number): number {
  return serverQuantity - (pendingDeltas()[variantId] ?? 0);
}

/** Drop every pending offline stock delta (used by Transaction Reset). */
export function clearAllDeltas() {
  persist({});
}

// Durable local transaction log. Every sale is recorded here first so the
// receipt remains available immediately, even when the device is offline.
import { IDB_KEYS, idbGet, idbSet } from "@/lib/offline-db";

const LOG_KEY = "tillpoint.transaction-log.v1";
const IDB_LOG_KEY = "transaction-log";

export type TxLogItem = {
  name: string;
  variant: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type TxLogEntry = {
  id: string;
  created_at: string;
  total: number;
  payment_type: string;
  cashier_name: string;
  items: TxLogItem[];
  status: "synced" | "queued" | "failed";
};

type Listener = (list: TxLogEntry[]) => void;
const listeners = new Set<Listener>();

function readStorage(): TxLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as TxLogEntry[]) : [];
  } catch {
    return [];
  }
}

let logCache = readStorage();

export function subscribeLog(fn: Listener): () => void {
  listeners.add(fn);
  fn(logCache.slice());
  return () => listeners.delete(fn);
}

function notify() {
  const snapshot = logCache.slice();
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch {
      /* noop */
    }
  }
}

function persist(list: TxLogEntry[]) {
  logCache = list;
  // Keep the synchronous mirror bounded so repeated offline sales never block
  // the cashier while the full history is written to IndexedDB.
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* best effort */
  }
  void idbSet(IDB_LOG_KEY, list);
  notify();
}

export function readLog(): TxLogEntry[] {
  return logCache.slice();
}

export async function hydrateLogFromIdb(): Promise<TxLogEntry[]> {
  const durable = (await idbGet<TxLogEntry[]>(IDB_LOG_KEY)) ?? [];
  const byId = new Map<string, TxLogEntry>();
  // Use the latest in-memory cache so hydration cannot erase a fresh sale.
  for (const e of [...durable, ...logCache]) byId.set(e.id, e);
  const merged = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  persist(merged);
  return merged;
}

export function appendLog(
  entry: Omit<TxLogEntry, "id" | "created_at"> & { id?: string; created_at?: string },
): TxLogEntry {
  const full: TxLogEntry = {
    id: entry.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    created_at: entry.created_at ?? new Date().toISOString(),
    total: entry.total,
    payment_type: entry.payment_type,
    cashier_name: entry.cashier_name,
    items: entry.items,
    status: entry.status,
  };
  persist([full, ...logCache]);
  return full;
}

export function markLogStatus(id: string, status: TxLogEntry["status"]) {
  persist(logCache.map((e) => (e.id === id ? { ...e, status } : e)));
}

export function clearLog() {
  persist([]);
}

export function logToRows(list: TxLogEntry[]): string[][] {
  const rows: string[][] = [
    [
      "When",
      "Cashier",
      "Payment",
      "Status",
      "Item",
      "Variant",
      "Qty",
      "Unit price",
      "Line total",
      "Sale total",
    ],
  ];
  for (const e of list) {
    for (const i of e.items) {
      rows.push([
        new Date(e.created_at).toLocaleString(),
        e.cashier_name,
        e.payment_type,
        e.status,
        i.name,
        i.variant,
        String(i.quantity),
        i.unit_price.toFixed(2),
        i.subtotal.toFixed(2),
        e.total.toFixed(2),
      ]);
    }
  }
  return rows;
}

export function logToCsv(list: TxLogEntry[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "When",
    "Cashier",
    "Payment",
    "Status",
    "Item",
    "Variant",
    "Qty",
    "Unit price",
    "Line total",
    "Sale total",
  ];
  const rows: string[] = [header.join(",")];
  for (const e of list) {
    for (const i of e.items) {
      rows.push(
        [
          new Date(e.created_at).toISOString(),
          e.cashier_name,
          e.payment_type,
          e.status,
          i.name,
          i.variant,
          i.quantity,
          i.unit_price.toFixed(2),
          i.subtotal.toFixed(2),
          e.total.toFixed(2),
        ]
          .map(esc)
          .join(","),
      );
    }
  }
  return rows.join("\n");
}

export { IDB_KEYS };

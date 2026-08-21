// Shift close / Z-report. Works entirely from the local transaction log so a
// cash-up can be done even with no connection.
import { idbGet, idbSet } from "@/lib/offline-db";
import { readLog, type TxLogEntry } from "@/lib/transaction-log";

const KEY = "tillpoint.shift-reports.v1";
const IDB_KEY = "shift-reports";

export type ShiftReport = {
  id: string;
  closed_at: string;
  opened_at: string;
  cashier_name: string;
  sale_count: number;
  total: number;
  by_payment: Record<string, number>;
  counted_cash: number | null;
  variance: number | null;
  note: string;
};

type Listener = (list: ShiftReport[]) => void;
const listeners = new Set<Listener>();

export function readReports(): ShiftReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ShiftReport[]) : [];
  } catch {
    return [];
  }
}

function writeReports(list: ShiftReport[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* noop */ }
  void idbSet(IDB_KEY, list);
  for (const fn of listeners) {
    try { fn(list); } catch { /* noop */ }
  }
}

export function subscribeReports(fn: Listener): () => void {
  listeners.add(fn);
  fn(readReports());
  return () => listeners.delete(fn);
}

export async function hydrateReports(): Promise<void> {
  if (readReports().length > 0) return;
  const durable = (await idbGet<ShiftReport[]>(IDB_KEY)) ?? [];
  if (durable.length > 0) writeReports(durable);
}

/** Start of the current shift: the moment the last shift was closed. */
export function shiftStart(): string {
  const last = readReports()[0];
  return last?.closed_at ?? new Date(0).toISOString();
}

export function currentShiftEntries(): TxLogEntry[] {
  const start = shiftStart();
  return readLog().filter((e) => e.created_at > start);
}

export function summarise(entries: TxLogEntry[]) {
  const by_payment: Record<string, number> = {};
  let total = 0;
  for (const e of entries) {
    total += e.total;
    by_payment[e.payment_type] = (by_payment[e.payment_type] ?? 0) + e.total;
  }
  const queued = entries.filter((e) => e.status === "queued").length;
  return { total, by_payment, sale_count: entries.length, queued };
}

export function closeShift(opts: { cashier_name: string; counted_cash: number | null; note: string }): ShiftReport {
  const entries = currentShiftEntries();
  const s = summarise(entries);
  const expectedCash = s.by_payment["cash"] ?? 0;
  const report: ShiftReport = {
    id: crypto.randomUUID?.() ?? `${Date.now()}`,
    closed_at: new Date().toISOString(),
    opened_at: shiftStart(),
    cashier_name: opts.cashier_name,
    sale_count: s.sale_count,
    total: s.total,
    by_payment: s.by_payment,
    counted_cash: opts.counted_cash,
    variance: opts.counted_cash === null ? null : Number((opts.counted_cash - expectedCash).toFixed(2)),
    note: opts.note,
  };
  writeReports([report, ...readReports()]);
  return report;
}

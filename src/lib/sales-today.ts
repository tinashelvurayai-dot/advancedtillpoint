// "Sales today" counter for the till header.
// The figure is derived from the local transaction log so it keeps working
// with no connection. A manager can reset it from Settings; the reset only
// moves a marker forward, it never deletes a recorded sale.
import type { TxLogEntry } from "@/lib/transaction-log";

const MARKER_KEY = "tillpoint.sales-today-reset.v1";
const EVENT = "tillpoint:sales-today-reset";

export function getSalesTodayMarker(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MARKER_KEY);
  } catch {
    return null;
  }
}

export function setSalesTodayMarker(iso: string = new Date().toISOString()) {
  try {
    window.localStorage.setItem(MARKER_KEY, iso);
  } catch {
    /* best effort */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeSalesTodayMarker(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === MARKER_KEY) fn();
  };
  window.addEventListener(EVENT, fn as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, fn as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

export function computeSalesToday(list: TxLogEntry[]): { total: number; count: number } {
  const stamp = new Date().toDateString();
  const marker = getSalesTodayMarker();
  const after = marker ? new Date(marker).getTime() : 0;
  const mine = list.filter((e) => {
    const at = new Date(e.created_at);
    return at.toDateString() === stamp && at.getTime() > after;
  });
  return {
    total: mine.reduce((sum, e) => sum + Number(e.total), 0),
    count: mine.length,
  };
}

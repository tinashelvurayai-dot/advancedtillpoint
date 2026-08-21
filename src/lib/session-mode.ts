// Single-shop till: exactly one manager and one cashier.
// The active mode on this device decides which controls are visible.
const MODE_KEY = "tillpoint.mode";

export type TillMode = "manager" | "cashier" | null;

type Listener = (m: TillMode) => void;
const listeners = new Set<Listener>();

export function getMode(): TillMode {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "manager" || v === "cashier") return v;
    // Legacy flags from earlier versions.
    if (localStorage.getItem("manager_unlock") === "true") return "manager";
    if (localStorage.getItem("cashier_unlock") === "true") return "cashier";
    return null;
  } catch {
    return null;
  }
}

export function isManagerMode(): boolean {
  return getMode() === "manager";
}

export function setMode(mode: Exclude<TillMode, null>) {
  try {
    localStorage.setItem(MODE_KEY, mode);
    if (mode === "manager") {
      localStorage.setItem("manager_unlock", "true");
      localStorage.removeItem("cashier_unlock");
    } else {
      localStorage.setItem("cashier_unlock", "true");
      // Leaving manager mode must remove manager privileges on this device.
      localStorage.removeItem("manager_unlock");
    }
  } catch {
    /* noop */
  }
  for (const fn of listeners) {
    try {
      fn(mode);
    } catch {
      /* noop */
    }
  }
}

export function clearMode() {
  try {
    localStorage.removeItem(MODE_KEY);
    localStorage.removeItem("manager_unlock");
    localStorage.removeItem("cashier_unlock");
  } catch {
    /* noop */
  }
  for (const fn of listeners) {
    try {
      fn(null);
    } catch {
      /* noop */
    }
  }
}

export function subscribeMode(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Single cashier identity for this shop, used for offline attribution. */
export const CASHIER_NAME = "Cashier";
export const MANAGER_NAME = "Manager";

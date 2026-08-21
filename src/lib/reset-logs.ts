// Audit trail of every reset performed from the manager Settings page.
// Stored on the device first (so it also works offline) and mirrored to the
// backend audit log when a connection is available.
import { supabase } from "@/integrations/supabase/client";

const KEY = "tillpoint.reset-logs.v1";
const EVENT = "tillpoint:reset-logs";

export type ResetLogEntry = {
  id: string;
  created_at: string;
  kind: "transaction_reset" | "sales_today_reset";
  label: string;
  details: string;
  amount: number | null;
  count: number | null;
  actor: string;
};

export function readResetLogs(): ResetLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ResetLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function subscribeResetLogs(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener(EVENT, fn as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, fn as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

export async function recordResetLog(
  input: Omit<ResetLogEntry, "id" | "created_at"> & { created_at?: string },
): Promise<ResetLogEntry> {
  const entry: ResetLogEntry = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    created_at: input.created_at ?? new Date().toISOString(),
    kind: input.kind,
    label: input.label,
    details: input.details,
    amount: input.amount,
    count: input.count,
    actor: input.actor,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify([entry, ...readResetLogs()].slice(0, 500)));
  } catch {
    /* best effort */
  }
  window.dispatchEvent(new CustomEvent(EVENT));

  // Mirror to the backend audit log; never block the reset if this fails.
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("audit_logs").insert({
        user_id: data.user.id,
        action: entry.kind,
        details: {
          label: entry.label,
          details: entry.details,
          amount: entry.amount,
          count: entry.count,
          actor: entry.actor,
          at: entry.created_at,
        },
      });
    }
  } catch {
    /* offline - the device copy is enough */
  }
  return entry;
}

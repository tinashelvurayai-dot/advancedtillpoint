// Persistent warning while any sale is parked as "failed".
// The till must never quietly lose a sale, so this stays on screen until the
// queue is clear again.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { failedSales, flushQueue, subscribeQueue } from "@/lib/offline-queue";

export function SyncAlertBanner() {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeQueue(() => setCount(failedSales().length)), []);

  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {count} sale{count === 1 ? "" : "s"} still waiting to reach the backend. Nothing is lost —
        they stay on this device until they sync.
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await flushQueue();
          setCount(failedSales().length);
          setBusy(false);
        }}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Retry now
      </Button>
      <Link to="/sync">
        <Button size="sm" variant="ghost">
          Open Sync Queue
        </Button>
      </Link>
    </div>
  );
}

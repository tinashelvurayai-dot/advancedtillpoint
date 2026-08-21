import { createFileRoute, Link } from "@tanstack/react-router";
import { isManagerMode } from "@/lib/session-mode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { getQueue, retrySale, subscribeQueue, type QueuedSale } from "@/lib/offline-queue";
import { readLog, subscribeLog, type TxLogEntry } from "@/lib/transaction-log";
import { runSync } from "@/lib/sync-manager";
import { useOnline } from "@/hooks/use-online";
import { SyncIndicator } from "@/components/sync-indicator";
import { ArrowLeft, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sync")({
  component: SyncQueuePage,
  head: () => ({
    meta: [
      { title: "Sync Queue - TillPoint POS" },
      {
        name: "description",
        content: "Track pending, uploading, synced and failed sales and retry uploads manually.",
      },
      { property: "og:title", content: "Sync Queue - TillPoint POS" },
      {
        property: "og:description",
        content: "Track pending, uploading, synced and failed sales and retry uploads manually.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function statusBadge(s: QueuedSale["status"]) {
  if (s === "uploading") return <Badge className="bg-blue-600">Uploading</Badge>;
  if (s === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

function SyncQueuePage() {
  const [manager, setManager] = useState(false);
  useEffect(() => {
    setManager(isManagerMode());
  }, []);
  const online = useOnline();
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [log, setLog] = useState<TxLogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setQueue(getQueue());
    setLog(readLog());
    const offQueue = subscribeQueue(() => setQueue(getQueue()));
    const offLog = subscribeLog(setLog);
    return () => {
      offQueue();
      offLog();
    };
  }, []);

  const pending = queue.filter((q) => q.status !== "failed").length;
  const uploading = queue.filter((q) => q.status === "uploading").length;
  const failed = queue.filter((q) => q.status === "failed").length;
  const synced = log.filter((e) => e.status === "synced").length;

  async function retryAll() {
    if (!online)
      return toast.error(
        "Still offline - retry will run automatically when the connection returns.",
      );
    setBusy(true);
    const res = await runSync();
    setBusy(false);
    setQueue(getQueue());
    if (res.failed > 0)
      toast.error(`${res.failed} sale${res.failed === 1 ? "" : "s"} still pending.`);
    else toast.success("All sales uploaded.");
  }

  async function retryOne(id: string) {
    if (!online) return toast.error("Still offline.");
    setBusy(true);
    const ok = await retrySale(id);
    setBusy(false);
    setQueue(getQueue());
    if (ok) toast.success("Sale uploaded.");
    else toast.error("Upload failed - it stays safe on this device.");
  }

  const cards = [
    { label: "Pending", value: pending },
    { label: "Uploading", value: uploading },
    { label: "Synced", value: synced },
    { label: "Failed", value: failed },
  ];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to={manager ? "/manager" : "/cashier"}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Sync queue</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {online
              ? "Connected - All data synchronized automatically."
              : "Offline Mode - Sales are being stored safely on this device."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncIndicator />
          <Button onClick={retryAll} disabled={busy || !online || queue.length === 0}>
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Retry all
          </Button>
        </div>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-2xl font-bold">{c.value}</div>
          </Card>
        ))}
      </section>

      <Card className="divide-y divide-border">
        {queue.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nothing waiting - every sale is uploaded.
          </div>
        ) : (
          queue.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {formatCurrency(q.total_amount)}
                  {statusBadge(q.status)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(q.queued_at).toLocaleString()} · {q.items.length} line
                  {q.items.length === 1 ? "" : "s"} · {q.payment_type} ·{" "}
                  {q.cashier_name ?? "Cashier"}
                </div>
                {q.last_error && (
                  <div className="text-xs text-destructive">
                    Attempt {q.attempts ?? 1}: {q.last_error}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !online}
                onClick={() => retryOne(q.id)}
              >
                Retry
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

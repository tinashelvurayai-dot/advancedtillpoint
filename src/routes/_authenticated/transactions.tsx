import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { isManagerMode, setMode } from "@/lib/session-mode";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand-logo";
import { SyncIndicator } from "@/components/sync-indicator";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Copy, Download, Trash2, Search, Printer } from "lucide-react";
import { printReceipt, downloadReceipt } from "@/lib/receipt";
import { toast } from "sonner";
import {
  clearLog,
  hydrateLogFromIdb,
  logToCsv,
  subscribeLog,
  type TxLogEntry,
} from "@/lib/transaction-log";
import { runSync } from "@/lib/sync-manager";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transaction Log - TillPoint" },
      {
        name: "description",
        content:
          "Every sale recorded on this till, including offline queued sales waiting to sync.",
      },
      { property: "og:title", content: "Transaction Log - TillPoint" },
      {
        property: "og:description",
        content:
          "Every sale recorded on this till, including offline queued sales waiting to sync.",
      },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const [entries, setEntries] = useState<TxLogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    // Manager tools appear only when this device is actually in manager mode.
    const manager = isManagerMode();
    setIsManager(manager);
    if (manager) setMode("manager");
    const off = subscribeLog(setEntries);
    void hydrateLogFromIdb();
    return off;
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        (paymentFilter === "all" || e.payment_type === paymentFilter) &&
        (statusFilter === "all" || e.status === statusFilter) &&
        (!dateFrom || e.created_at.slice(0, 10) >= dateFrom) &&
        (!dateTo || e.created_at.slice(0, 10) <= dateTo) &&
        (e.cashier_name.toLowerCase().includes(q) ||
          e.payment_type.toLowerCase().includes(q) ||
          e.status.includes(q) ||
          e.items.some((i) => `${i.name} ${i.variant}`.toLowerCase().includes(q))),
    );
  }, [entries, query, paymentFilter, statusFilter, dateFrom, dateTo]);

  const total = filtered.reduce((s, e) => s + e.total, 0);
  const queued = entries.filter((e) => e.status === "queued").length;

  async function copyAll() {
    const text = logToCsv(filtered);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Transaction log copied to clipboard");
    } catch {
      toast.error("Clipboard blocked - use Download CSV instead");
    }
  }

  function downloadCsv() {
    const blob = new Blob([logToCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaction-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  function doClear() {
    if (queued > 0 && !confirm(`${queued} sale(s) have not synced yet. Clear anyway?`)) return;
    if (!confirm("Clear the whole transaction log on this device?")) return;
    clearLog();
    toast.success("Transaction log cleared");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div className="hidden border-l border-border pl-3 sm:block">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Transaction log
            </div>
            <div className="text-sm font-semibold">
              {isManager ? "Manager view" : "Cashier view"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncIndicator />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void runSync();
            }}
          >
            Sync now
          </Button>
          <Link to={isManager ? "/manager" : "/cashier"}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-4 sm:p-6 md:p-10">
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <div className="text-sm text-muted-foreground">Transactions</div>
            <div className="mt-1 text-2xl font-bold">{filtered.length}</div>
          </Card>
          <Card className="p-5">
            <div className="text-sm text-muted-foreground">Value</div>
            <div className="mt-1 text-2xl font-bold">{formatCurrency(total)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-sm text-muted-foreground">Waiting to sync</div>
            <div className="mt-1 text-2xl font-bold">{queued}</div>
          </Card>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search item, cashier, payment..."
              className="pl-9"
            />
          </div>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All payments</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="mobile">Mobile</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="synced">Synced</option>
            <option value="queued">Saved offline</option>
            <option value="failed">Failed</option>
          </select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
          />
          {isManager && (
            <>
              <Button variant="outline" size="sm" onClick={copyAll}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={downloadCsv}>
                <Download className="mr-2 h-4 w-4" /> Download CSV
              </Button>
              <Button variant="destructive" size="sm" onClick={doClear}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear
              </Button>
            </>
          )}
        </div>

        {!isManager && (
          <p className="mb-4 text-xs text-muted-foreground">
            Only the manager can copy or clear these records.
          </p>
        )}

        {filtered.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No transactions recorded on this device yet.
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => (
              <Card key={e.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{formatDate(e.created_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.cashier_name} · {e.payment_type}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        e.status === "synced"
                          ? "secondary"
                          : e.status === "queued"
                            ? "outline"
                            : "destructive"
                      }
                      className="capitalize"
                    >
                      {e.status === "queued" ? "Saved offline" : e.status}
                    </Badge>
                    <span className="text-base font-bold">{formatCurrency(e.total)}</span>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 border-t border-dashed border-border pt-3 text-sm">
                  {e.items.map((i, idx) => (
                    <li key={idx} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {i.quantity} × {i.name}
                        <span className="text-muted-foreground"> {i.variant}</span>
                      </span>
                      <span className="tabular-nums">{formatCurrency(i.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button variant="outline" size="sm" onClick={() => printReceipt(e)}>
                    <Printer className="mr-2 h-4 w-4" /> Reprint receipt
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadReceipt(e)}>
                    <Download className="mr-2 h-4 w-4" /> Save receipt
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

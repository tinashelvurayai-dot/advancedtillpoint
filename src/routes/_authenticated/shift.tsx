import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BrandLogo } from "@/components/brand-logo";
import { SyncIndicator } from "@/components/sync-indicator";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Download, Lock as LockIcon } from "lucide-react";
import { toast } from "sonner";
import { subscribeLog, type TxLogEntry } from "@/lib/transaction-log";
import {
  closeShift,
  currentShiftEntries,
  hydrateReports,
  subscribeReports,
  summarise,
  type ShiftReport,
} from "@/lib/shift-report";
import { isManagerMode, CASHIER_NAME } from "@/lib/session-mode";
import { printZReport } from "@/lib/z-report";
import { cachedQuery } from "@/lib/cached-query";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/shift")({
  head: () => ({
    meta: [
      { title: "Shift Close & Z-Report - TillPoint" },
      { name: "description", content: "Cash up the till: totals by payment type, counted cash and variance for the current shift." },
      { property: "og:title", content: "Shift Close & Z-Report - TillPoint" },
      { property: "og:description", content: "Cash up the till: totals by payment type, counted cash and variance for the current shift." },
    ],
  }),
  component: ShiftPage,
});

function ShiftPage() {
  const [, setLog] = useState<TxLogEntry[]>([]);
  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [manager, setManager] = useState(false);

  // Expenses per day, so the Z-report reconciles cash against the money that
  // actually left the drawer.
  const expenses = useQuery({
    queryKey: ["shift-expenses"],
    ...cachedQuery<Array<{ expense_date: string; amount: number; category: string }>>(
      "shift-expenses",
      async () => {
        const { data, error } = await supabase
          .from("expenses")
          .select("expense_date, amount, category")
          .order("expense_date", { ascending: false })
          .limit(500);
        if (error) throw error;
        return data ?? [];
      },
    ),
  });

  function expensesFor(iso: string) {
    const day = iso.slice(0, 10);
    const list = (expenses.data ?? []).filter((e) => e.expense_date === day);
    return {
      total: list.reduce((t, e) => t + Number(e.amount), 0),
      lines: list.map((e) => ({ label: e.category, amount: Number(e.amount) })),
    };
  }

  useEffect(() => {
    setManager(isManagerMode());
    void hydrateReports();
    const offLog = subscribeLog(setLog);
    const offRep = subscribeReports(setReports);
    return () => { offLog(); offRep(); };
  }, []);

  const entries = useMemo(() => currentShiftEntries(), [reports, setLog]);
  const s = summarise(entries);
  const expectedCash = s.by_payment["cash"] ?? 0;
  const countedNum = counted.trim() === "" ? null : Number(counted);
  const variance = countedNum === null || Number.isNaN(countedNum) ? null : countedNum - expectedCash;

  function doClose() {
    if (entries.length === 0) return toast.error("No sales in this shift yet");
    if (s.queued > 0 && !confirm(`${s.queued} sale(s) are still waiting to sync. Close the shift anyway?`)) return;
    const r = closeShift({
      cashier_name: manager ? "Manager" : CASHIER_NAME,
      counted_cash: countedNum !== null && !Number.isNaN(countedNum) ? countedNum : null,
      note: note.trim(),
    });
    setCounted("");
    setNote("");
    toast.success(`Shift closed - ${formatCurrency(r.total)} over ${r.sale_count} sale(s)`);
  }

  function downloadZ(r: ShiftReport) {
    const lines = [
      "TILLPOINT Z-REPORT",
      `Closed: ${new Date(r.closed_at).toLocaleString()}`,
      `Opened: ${new Date(r.opened_at).toLocaleString()}`,
      `Operator: ${r.cashier_name}`,
      `Sales: ${r.sale_count}`,
      ...Object.entries(r.by_payment).map(([k, v]) => `${k}: ${v.toFixed(2)}`),
      `TOTAL: ${r.total.toFixed(2)}`,
      `Counted cash: ${r.counted_cash === null ? "n/a" : r.counted_cash.toFixed(2)}`,
      `Variance: ${r.variance === null ? "n/a" : r.variance.toFixed(2)}`,
      r.note ? `Note: ${r.note}` : "",
    ].filter(Boolean);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `z-report-${r.closed_at.slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div className="hidden border-l border-border pl-3 sm:block">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Shift close</div>
            <div className="text-sm font-semibold">Z-Report</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SyncIndicator />
          <Link to={manager ? "/manager" : "/cashier"}>
            <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          </Link>
        </div>
      </header>

      <div className="p-4 sm:p-6 md:p-10">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5"><div className="text-sm text-muted-foreground">Sales this shift</div><div className="mt-1 text-2xl font-bold">{s.sale_count}</div></Card>
          <Card className="p-5"><div className="text-sm text-muted-foreground">Shift total</div><div className="mt-1 text-2xl font-bold">{formatCurrency(s.total)}</div></Card>
          <Card className="p-5"><div className="text-sm text-muted-foreground">Waiting to sync</div><div className="mt-1 text-2xl font-bold">{s.queued}</div></Card>
        </div>

        <Card className="mt-6 p-5">
          <h2 className="text-base font-semibold">Breakdown by payment</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {Object.keys(s.by_payment).length === 0 ? (
              <li className="text-muted-foreground">No sales yet in this shift.</li>
            ) : (
              Object.entries(s.by_payment).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between border-b border-dashed border-border py-1 last:border-0">
                  <span className="capitalize">{k}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(v)}</span>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className="mt-6 p-5">
          <h2 className="text-base font-semibold">Cash up</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="counted">Counted cash in drawer</Label>
              <Input id="counted" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0.00" />
              <p className="text-xs text-muted-foreground">
                Expected cash: {formatCurrency(expectedCash)}
                {variance !== null && (
                  <span className={variance === 0 ? "" : variance > 0 ? " text-emerald-600" : " text-destructive"}>
                    {" "}- variance {formatCurrency(variance)}
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </div>
          </div>
          <Button className="mt-4" onClick={doClose}><LockIcon className="mr-2 h-4 w-4" /> Close shift</Button>
        </Card>

        <h2 className="mt-8 text-base font-semibold">Past shifts</h2>
        {reports.length === 0 ? (
          <Card className="mt-3 p-8 text-center text-sm text-muted-foreground">No shifts closed on this device yet.</Card>
        ) : (
          <div className="mt-3 space-y-3">
            {reports.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{formatDate(r.closed_at)}</div>
                    <div className="text-xs text-muted-foreground">{r.cashier_name} · {r.sale_count} sale(s)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold">{formatCurrency(r.total)}</span>
                    <Button
                      size="sm"
                      onClick={() => {
                        const e = expensesFor(r.closed_at);
                        printZReport(r, { expenses: e.total, expenseLines: e.lines });
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" /> Z-report PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadZ(r)}><Download className="mr-2 h-4 w-4" /> Text</Button>
                  </div>
                </div>
                {r.counted_cash !== null && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Counted {formatCurrency(r.counted_cash)} · variance {formatCurrency(r.variance ?? 0)}
                  </div>
                )}
                {r.note && <div className="mt-1 text-xs italic text-muted-foreground">{r.note}</div>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

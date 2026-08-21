import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollText, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { readResetLogs, subscribeResetLogs, type ResetLogEntry } from "@/lib/reset-logs";

export const Route = createFileRoute("/_authenticated/manager/logs")({
  component: LogsPage,
  head: () => ({
    meta: [
      { title: "Reset Logs · TillPoint Manager" },
      {
        name: "description",
        content:
          "Audit trail of every transaction and sales-today reset performed on this till, with date, time, amount and item counts.",
      },
      { property: "og:title", content: "Reset Logs · TillPoint Manager" },
      {
        property: "og:description",
        content: "Every reset performed on this till with date, time and amounts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function LogsPage() {
  const [logs, setLogs] = useState<ResetLogEntry[]>([]);
  useEffect(() => {
    const read = () => setLogs(readResetLogs());
    read();
    return subscribeResetLogs(read);
  }, []);

  function exportCsv() {
    const rows = [
      ["When", "Action", "Details", "Amount cleared", "Records cleared", "By"],
      ...logs.map((l) => [
        formatDate(l.created_at),
        l.label,
        l.details,
        l.amount === null ? "" : String(l.amount),
        l.count === null ? "" : String(l.count),
        l.actor,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reset-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <ScrollText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reset logs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every Transaction Reset and Sales-today Reset performed from Settings, with the date,
              time, what was cleared and the amount involved.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={logs.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </header>

      <Card className="overflow-hidden">
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3 text-right">Amount cleared</th>
                <th className="px-4 py-3 text-right">Records</th>
                <th className="px-4 py-3">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length ? (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(l.created_at)}</td>
                    <td className="px-4 py-3 font-medium">{l.label}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.details}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {l.amount === null ? "-" : formatCurrency(l.amount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.count ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.actor}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No resets have been performed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

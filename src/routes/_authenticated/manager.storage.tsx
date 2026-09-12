import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, HardDrive, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { clearLog, readLog, subscribeLog, type TxLogEntry } from "@/lib/transaction-log";
import { getQueue, subscribeQueue, type QueuedSale } from "@/lib/offline-queue";

export const Route = createFileRoute("/_authenticated/manager/storage")({
  component: ManagerStoragePage,
});

type Row = {
  id: string;
  created_at: string;
  cashier: string;
  payment: string;
  status: string;
  source: "Cloud" | "This device";
  item: string;
  variant: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sale_total: number;
};

const HEADER = [
  "When",
  "Cashier",
  "Payment",
  "Status",
  "Source",
  "Item",
  "Variant",
  "Qty",
  "Unit price",
  "Line total",
  "Sale total",
];

function toMatrix(rows: Row[]): string[][] {
  return [
    HEADER,
    ...rows.map((r) => [
      new Date(r.created_at).toLocaleString(),
      r.cashier,
      r.payment,
      r.status,
      r.source,
      r.item,
      r.variant,
      String(r.quantity),
      r.unit_price.toFixed(2),
      r.line_total.toFixed(2),
      r.sale_total.toFixed(2),
    ]),
  ];
}

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value))
        .join(","),
    )
    .join("\n");
}

function htmlTable(rows: string[][], title: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font:14px Arial;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#eef2ff}</style></head><body><h1>${title}</h1><table>${rows
    .map(
      (row, index) =>
        `<tr>${row
          .map((value) => (index === 0 ? `<th>${value}</th>` : `<td>${value}</td>`))
          .join("")}</tr>`,
    )
    .join("")}</table></body></html>`;
}

function ManagerStoragePage() {
  const [localLog, setLocalLog] = useState<TxLogEntry[]>([]);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setLocalLog(readLog());
    setQueue(getQueue());
    const offLog = subscribeLog(setLocalLog);
    const offQueue = subscribeQueue(() => setQueue(getQueue()));
    return () => {
      offLog();
      offQueue();
    };
  }, []);

  const cloud = useQuery({
    queryKey: ["manager", "storage", "sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id, created_at, total_amount, payment_type, status, cashier_name, sale_items(quantity, unit_price, subtotal, variant:product_variants(variant_name, product:products(name)))",
        )
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const sale of (cloud.data ?? []) as any[]) {
      const items = sale.sale_items ?? [];
      if (!items.length) {
        out.push({
          id: sale.id,
          created_at: sale.created_at,
          cashier: sale.cashier_name ?? "Cashier",
          payment: sale.payment_type,
          status: sale.status ?? "completed",
          source: "Cloud",
          item: "(no items)",
          variant: "",
          quantity: 0,
          unit_price: 0,
          line_total: 0,
          sale_total: Number(sale.total_amount),
        });
      }
      for (const it of items) {
        out.push({
          id: sale.id,
          created_at: sale.created_at,
          cashier: sale.cashier_name ?? "Cashier",
          payment: sale.payment_type,
          status: sale.status ?? "completed",
          source: "Cloud",
          item: it.variant?.product?.name ?? "Item",
          variant: it.variant?.variant_name ?? "",
          quantity: it.quantity,
          unit_price: Number(it.unit_price),
          line_total: Number(it.subtotal),
          sale_total: Number(sale.total_amount),
        });
      }
    }
    // Only device sales that never reached the cloud.
    for (const entry of localLog.filter((e) => e.status !== "synced")) {
      for (const it of entry.items) {
        out.push({
          id: entry.id,
          created_at: entry.created_at,
          cashier: entry.cashier_name,
          payment: entry.payment_type,
          status: entry.status,
          source: "This device",
          item: it.name,
          variant: it.variant,
          quantity: it.quantity,
          unit_price: Number(it.unit_price),
          line_total: Number(it.subtotal),
          sale_total: Number(entry.total),
        });
      }
    }
    return out
      .filter(
        (r) =>
          (!dateFrom || r.created_at.slice(0, 10) >= dateFrom) &&
          (!dateTo || r.created_at.slice(0, 10) <= dateTo),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [cloud.data, localLog, dateFrom, dateTo]);

  const saleCount = new Set(rows.map((r) => r.id)).size;
  const totalValue = [...new Map(rows.map((r) => [r.id, r.sale_total])).values()].reduce(
    (sum, v) => sum + v,
    0,
  );
  const pending = queue.length;

  function exportFile(format: "csv" | "xlsx" | "docx" | "pdf") {
    if (!rows.length) {
      toast.error("There are no transactions in this date range to export.");
      return;
    }
    const matrix = toMatrix(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      download(`transactions-${stamp}.csv`, csv(matrix), "text/csv;charset=utf-8");
    } else if (format === "xlsx") {
      download(
        `transactions-${stamp}.xls`,
        htmlTable(matrix, "TillPoint transactions"),
        "application/vnd.ms-excel",
      );
    } else if (format === "docx") {
      download(
        `transactions-${stamp}.doc`,
        htmlTable(matrix, "TillPoint transactions"),
        "application/msword",
      );
    } else {
      const popup = window.open("", "_blank");
      if (!popup) {
        toast.error("Allow pop-ups for this site to print a PDF export.");
        return;
      }
      popup.document.write(htmlTable(matrix, "TillPoint transactions"));
      popup.document.close();
      popup.focus();
      popup.print();
      return;
    }
    toast.success(`Exported ${rows.length} lines as ${format.toUpperCase()}.`);
  }

  function clearDevice() {
    if (pending > 0) {
      toast.error(`${pending} sale${pending === 1 ? " is" : "s are"} still waiting to sync.`);
      return;
    }
    if (
      !window.confirm(
        "Clear the sales history stored on this device? Sales already uploaded stay safe in the cloud.",
      )
    )
      return;
    clearLog();
    toast.success("Device sales history cleared.");
  }

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Storage & exports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every sale from the cloud plus anything still held on this device.
        </p>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <HardDrive className="mb-3 h-5 w-5 text-primary" />
          <div className="text-sm text-muted-foreground">Transactions</div>
          <div className="mt-1 text-2xl font-bold">{cloud.isLoading ? "…" : saleCount}</div>
        </Card>
        <Card className="p-5">
          <Download className="mb-3 h-5 w-5 text-primary" />
          <div className="text-sm text-muted-foreground">Value</div>
          <div className="mt-1 text-2xl font-bold">{formatCurrency(totalValue)}</div>
        </Card>
        <Card className="p-5">
          <FileText className="mb-3 h-5 w-5 text-warning" />
          <div className="text-sm text-muted-foreground">Waiting to sync</div>
          <div className="mt-1 text-2xl font-bold">{pending}</div>
        </Card>
        <Card className="p-5">
          <RefreshCw className="mb-3 h-5 w-5 text-primary" />
          <div className="text-sm text-muted-foreground">On this device</div>
          <div className="mt-1">
            <Badge variant="outline">{localLog.length} saved</Badge>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">Export transactions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Excel and Word exports open in compatible office applications. PDF uses the browser print
          dialog.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Date range</span>
          <Input
            type="date"
            className="w-auto"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Export from date"
          />
          <Input
            type="date"
            className="w-auto"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Export to date"
          />
          <Button variant="ghost" size="sm" onClick={() => void cloud.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => exportFile("xlsx")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" onClick={() => exportFile("docx")}>
            <FileText className="mr-2 h-4 w-4" /> Word
          </Button>
          <Button variant="outline" onClick={() => exportFile("pdf")}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={() => exportFile("csv")}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <Button variant="destructive" onClick={clearDevice} disabled={pending > 0}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear this device&apos;s history
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            This only clears the copy kept on this device, and is blocked while sales are still
            waiting to sync. To wipe all sales everywhere use Transaction Reset on the Settings
            page.
          </p>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 font-semibold">Preview ({rows.length} lines)</h2>
        {cloud.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading transactions…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Qty</th>
                  <th className="py-2 pr-4 font-medium">Line total</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={`${r.id}-${i}`} className="border-b border-border/60">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="py-2 pr-4">
                      {r.item}
                      {r.variant ? ` · ${r.variant}` : ""}
                    </td>
                    <td className="py-2 pr-4">{r.quantity}</td>
                    <td className="py-2 pr-4">{formatCurrency(r.line_total)}</td>
                    <td className="py-2 pr-4 capitalize">{r.status.replaceAll("_", " ")}</td>
                    <td className="py-2">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing the newest 50 lines — exports include all {rows.length}.
              </p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

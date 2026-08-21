import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, HardDrive, Trash2 } from "lucide-react";
import { clearLog, logToRows, readLog, subscribeLog, type TxLogEntry } from "@/lib/transaction-log";
import { getQueue, subscribeQueue, type QueuedSale } from "@/lib/offline-queue";

export const Route = createFileRoute("/_authenticated/manager/storage")({
  component: ManagerStoragePage,
});

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
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
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font:14px Arial;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#eef2ff}</style></head><body><h1>${title}</h1><table>${rows.map((row, index) => `<tr>${row.map((value) => (index === 0 ? `<th>${value}</th>` : `<td>${value}</td>`)).join("")}</tr>`).join("")}</table></body></html>`;
}

function ManagerStoragePage() {
  const [entries, setEntries] = useState<TxLogEntry[]>([]);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [exported, setExported] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const offLog = subscribeLog(setEntries);
    const offQueue = subscribeQueue(() => setQueue(getQueue()));
    setQueue(getQueue());
    return () => {
      offLog();
      offQueue();
    };
  }, []);

  const filteredEntries = entries.filter(
    (entry) =>
      (!dateFrom || entry.created_at.slice(0, 10) >= dateFrom) &&
      (!dateTo || entry.created_at.slice(0, 10) <= dateTo),
  );
  const rows = logToRows(filteredEntries);
  const pending = queue.length;

  function exportFile(format: "csv" | "xlsx" | "docx" | "pdf") {
    if (!entries.length) {
      toast.error("There are no local transactions to export.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv")
      download(`transactions-${stamp}.csv`, csv(rows), "text/csv;charset=utf-8");
    if (format === "xlsx")
      download(
        `transactions-${stamp}.xls`,
        htmlTable(rows, "TillPoint transactions"),
        "application/vnd.ms-excel",
      );
    if (format === "docx")
      download(
        `transactions-${stamp}.doc`,
        htmlTable(rows, "TillPoint transactions"),
        "application/msword",
      );
    if (format === "pdf") {
      const popup = window.open("", "_blank", "noopener,noreferrer");
      if (!popup) {
        toast.error("Allow popups to print a PDF export.");
        return;
      }
      popup.document.write(htmlTable(rows, "TillPoint transactions"));
      popup.document.close();
      popup.focus();
      popup.print();
    }
    if (format !== "pdf" || window.confirm("Did the PDF print dialog complete successfully?")) {
      setExported(true);
      toast.success(`Transactions exported as ${format.toUpperCase()}.`);
    }
  }

  function clearAfterExport() {
    if (!exported) {
      toast.error("Export the transactions first, then clearing will unlock.");
      return;
    }
    if (pending > 0) {
      toast.error(`${pending} sale${pending === 1 ? " is" : "s are"} still waiting to sync.`);
      return;
    }
    if (
      !window.confirm(
        "Clear all local transaction records from this device? This cannot be undone.",
      )
    )
      return;
    clearLog();
    setExported(false);
    toast.success("Local transaction storage cleared.");
  }

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Storage & exports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Export local sales before clearing this device&apos;s transaction history.
        </p>
      </header>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <HardDrive className="mb-3 h-5 w-5 text-primary" />
          <div className="text-sm text-muted-foreground">Local transactions</div>
          <div className="mt-1 text-2xl font-bold">{entries.length}</div>
        </Card>
        <Card className="p-5">
          <Download className="mb-3 h-5 w-5 text-primary" />
          <div className="text-sm text-muted-foreground">Export status</div>
          <div className="mt-1">
            <Badge variant={exported ? "secondary" : "outline"}>
              {exported ? "Ready to clear" : "Export required"}
            </Badge>
          </div>
        </Card>
        <Card className="p-5">
          <FileText className="mb-3 h-5 w-5 text-warning" />
          <div className="text-sm text-muted-foreground">Waiting to sync</div>
          <div className="mt-1 text-2xl font-bold">{pending}</div>
        </Card>
      </div>
      <Card className="p-6">
        <h2 className="font-semibold">Choose an export format</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Excel and Word exports open in compatible office applications. PDF uses the browser print
          dialog.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Date range</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setExported(false);
            }}
            aria-label="Export from date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setExported(false);
            }}
            aria-label="Export to date"
          />
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
          <Button
            variant="destructive"
            onClick={clearAfterExport}
            disabled={!exported || pending > 0}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Clear local storage
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Clearing is locked until an export completes and all queued sales are synced.
          </p>
        </div>
      </Card>
    </div>
  );
}

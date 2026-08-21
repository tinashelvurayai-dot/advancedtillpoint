import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Download, Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/manager/sales")({
  component: SalesPage,
});

function toCsv(rows: any[]): string {
  const header = ["When", "Cashier", "Items", "Payment", "Total"];
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((s) =>
    [
      new Date(s.created_at).toISOString(),
      s.cashier_name ?? "Cashier",
      s.items?.reduce((a: number, x: any) => a + x.quantity, 0) ?? 0,
      s.payment_type,
      Number(s.total_amount).toFixed(2),
    ]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

function SalesPage() {
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("all");
  const [range, setRange] = useState<"all" | "today" | "week">("all");
  const sales = useQuery({
    queryKey: ["sales", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id, total_amount, payment_type, status, created_at, cashier_name, items:sale_items(quantity)",
        )
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredSales = useMemo(() => {
    const now = Date.now();
    const start =
      range === "today"
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : range === "week"
          ? now - 7 * 86400000
          : 0;
    const q = search.toLowerCase().trim();
    return (sales.data ?? []).filter((s: any) => {
      const cashier = s.cashier_name ?? "";
      return (
        new Date(s.created_at).getTime() >= start &&
        (payment === "all" || s.payment_type === payment) &&
        (!q || `${s.id} ${cashier} ${s.payment_type}`.toLowerCase().includes(q))
      );
    });
  }, [sales.data, search, payment, range]);

  const total = filteredSales.reduce((s, r) => s + Number(r.total_amount), 0);

  function exportCsv() {
    const rows = filteredSales;
    if (rows.length === 0) {
      toast.error("No sales to export");
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} sales`);
  }

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent transactions across your shop.
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cashier, payment, sale ID..."
            className="pl-9"
          />
        </div>
        <select
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All payments</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="mobile">Mobile</option>
        </select>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as typeof range)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
        </select>
        <Button variant="outline" onClick={() => void sales.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Transactions</div>
          <div className="mt-1 text-2xl font-bold">{filteredSales.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Gross revenue</div>
          <div className="mt-1 text-2xl font-bold">{formatCurrency(total)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Avg ticket</div>
          <div className="mt-1 text-2xl font-bold">
            {formatCurrency(filteredSales.length ? total / filteredSales.length : 0)}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : sales.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No sales yet.
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDate(s.created_at)}</TableCell>
                  <TableCell>{s.cashier_name ?? "Cashier"}</TableCell>
                  <TableCell>
                    {s.items?.reduce((a: number, x: any) => a + x.quantity, 0) ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {s.payment_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(s.total_amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

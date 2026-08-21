import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { cachedQuery } from "@/lib/cached-query";
import { TrendingUp, Coins, Receipt, PiggyBank } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manager/profit")({
  component: ProfitPage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type Line = {
  quantity: number;
  unit_price: number;
  subtotal: number;
  variant_id: string;
  sale: { created_at: string; status: string } | null;
  variant: { variant_name: string; product: { name: string } | null } | null;
};

function ProfitPage() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());

  const lines = useQuery({
    queryKey: ["profit-lines", from, to],
    ...cachedQuery<Line[]>(`profit-lines-${from}-${to}`, async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select(
          "quantity, unit_price, subtotal, variant_id, sale:sales(created_at, status), variant:product_variants(variant_name, product:products(name))",
        )
        .gte("created_at", `${from}T00:00:00Z`)
        .lte("created_at", `${to}T23:59:59Z`)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Line[];
    }),
  });

  // Cost basis: weighted average buying price captured at Stock-In.
  const costs = useQuery({
    queryKey: ["variant-costs"],
    ...cachedQuery<Record<string, number>>("variant-costs", async () => {
      const { data, error } = await (supabase as any)
        .from("stock_in_records")
        .select("variant_id, quantity, unit_buying_price")
        .limit(5000);
      if (error) throw error;
      const agg: Record<string, { qty: number; cost: number }> = {};
      for (const r of (data ?? []) as any[]) {
        const a = (agg[r.variant_id] ??= { qty: 0, cost: 0 });
        a.qty += Number(r.quantity);
        a.cost += Number(r.quantity) * Number(r.unit_buying_price);
      }
      const map: Record<string, number> = {};
      for (const [id, a] of Object.entries(agg)) map[id] = a.qty > 0 ? a.cost / a.qty : 0;
      return map;
    }),
  });

  const expenses = useQuery({
    queryKey: ["profit-expenses", from, to],
    ...cachedQuery<{ amount: number }[]>(`profit-expenses-${from}-${to}`, async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .gte("expense_date", from)
        .lte("expense_date", to);
      if (error) throw error;
      return data ?? [];
    }),
  });

  const view = useMemo(() => {
    const costMap = costs.data ?? {};
    const rows: Record<string, { name: string; qty: number; revenue: number; cogs: number }> = {};
    let revenue = 0;
    let cogs = 0;
    for (const l of lines.data ?? []) {
      if (l.sale && (l.sale.status === "refunded" || l.sale.status === "voided")) continue;
      const unitCost = costMap[l.variant_id] ?? 0;
      const lineCost = unitCost * l.quantity;
      revenue += Number(l.subtotal);
      cogs += lineCost;
      const key = l.variant_id;
      const name = `${l.variant?.product?.name ?? "Product"} — ${l.variant?.variant_name ?? ""}`;
      const r = (rows[key] ??= { name, qty: 0, revenue: 0, cogs: 0 });
      r.qty += l.quantity;
      r.revenue += Number(l.subtotal);
      r.cogs += lineCost;
    }
    const expenseTotal = (expenses.data ?? []).reduce((t, e) => t + Number(e.amount), 0);
    const list = Object.values(rows).sort((a, b) => b.revenue - a.revenue - (a.cogs - b.cogs));
    return { revenue, cogs, expenseTotal, gross: revenue - cogs, net: revenue - cogs - expenseTotal, list };
  }, [lines.data, costs.data, expenses.data]);

  const margin = view.revenue > 0 ? (view.gross / view.revenue) * 100 : 0;

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Profit View</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revenue from sales, cost of goods from the buying prices captured on Stock-In, minus the
          expenses recorded for the same period. Tax rate is 0%.
        </p>
      </header>

      <Card className="mb-6 flex flex-wrap items-end gap-4 p-5">
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="h-4 w-4" /> Revenue
          </div>
          <div className="mt-1 text-2xl font-bold">{formatCurrency(view.revenue)}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" /> Cost of goods
          </div>
          <div className="mt-1 text-2xl font-bold">{formatCurrency(view.cogs)}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" /> Gross profit
          </div>
          <div className="mt-1 text-2xl font-bold">{formatCurrency(view.gross)}</div>
          <div className="text-xs text-muted-foreground">{margin.toFixed(1)}% margin</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PiggyBank className="h-4 w-4" /> Net after expenses
          </div>
          <div className="mt-1 text-2xl font-bold">{formatCurrency(view.net)}</div>
          <div className="text-xs text-muted-foreground">
            expenses {formatCurrency(view.expenseTotal)}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-3 font-semibold">Profit by product</h2>
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Product</th>
                <th className="py-2 text-right">Sold</th>
                <th className="py-2 text-right">Revenue</th>
                <th className="py-2 text-right">Cost</th>
                <th className="py-2 text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {view.list.map((r) => (
                <tr key={r.name} className="border-t border-border">
                  <td className="py-2 pr-2">{r.name}</td>
                  <td className="py-2 text-right tabular-nums">{r.qty}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(r.revenue)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(r.cogs)}</td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatCurrency(r.revenue - r.cogs)}
                  </td>
                </tr>
              ))}
              {view.list.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No sales in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Products with no Stock-In buying price recorded are counted at zero cost, so record
          buying prices on the Stock-In Records page to keep this accurate.
        </p>
      </Card>
    </div>
  );
}

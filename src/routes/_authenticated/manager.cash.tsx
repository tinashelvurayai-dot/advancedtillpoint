import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Wallet, TrendingUp, TrendingDown, Calendar, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/manager/cash")({
  component: DailyCashPage,
});

function DailyCashPage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const entries = useQuery({
    queryKey: ["daily-cash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_cash")
        .select("id, collection_date, amount, notes, created_at, recorded_by")
        .order("collection_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  const salesToday = useQuery({
    queryKey: ["sales-by-day"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("sales")
        .select("total_amount, created_at, payment_type")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const expenses = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, expense_date")
        .gte("expense_date", since.toISOString().slice(0, 10));
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const list = entries.data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const todayEntry = list.find((e) => e.collection_date === today);
    const total7 = list.filter((e) => new Date(e.collection_date) >= new Date(Date.now() - 7 * 24 * 3600 * 1000))
      .reduce((s, e) => s + Number(e.amount), 0);
    const total30 = list.reduce((s, e) => s + Number(e.amount), 0);

    // Expected today from sales (cash only)
    const cashSalesToday = (salesToday.data ?? [])
      .filter((s) => s.payment_type === "cash" && s.created_at.slice(0, 10) === today)
      .reduce((s, r) => s + Number(r.total_amount), 0);
    // Cash paid out for expenses on the same day reduces the cash that should
    // still be in the drawer, so the collection balances against it.
    const expensesToday = (expenses.data ?? [])
      .filter((e) => String(e.expense_date).slice(0, 10) === today)
      .reduce((s, e) => s + Number(e.amount), 0);
    const expectedToday = cashSalesToday - expensesToday;
    const variance = Number(todayEntry?.amount ?? 0) - expectedToday;

    return {
      todayTotal: Number(todayEntry?.amount ?? 0),
      total7,
      total30,
      cashSalesToday,
      expensesToday,
      expectedToday,
      variance,
    };
  }, [entries.data, salesToday.data, expenses.data]);

  const add = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase.from("daily_cash").insert({
        collection_date: date,
        amount: amt,
        notes: notes || null,
        recorded_by: session?.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cash entry recorded");
      setAmount(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["daily-cash"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_cash").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry removed");
      qc.invalidateQueries({ queryKey: ["daily-cash"] });
    },
  });

  const cards = [
    { label: "Today's collection", value: formatCurrency(stats.todayTotal), icon: Wallet, tint: "text-blue-600" },
    { label: "Cash sales today", value: formatCurrency(stats.cashSalesToday), icon: Calendar, tint: "text-slate-600" },
    { label: "Expenses today", value: formatCurrency(stats.expensesToday), icon: TrendingDown, tint: "text-amber-600" },
    { label: "Expected in drawer (sales - expenses)", value: formatCurrency(stats.expectedToday), icon: Wallet, tint: "text-slate-600" },
    { label: "Variance today", value: formatCurrency(stats.variance), icon: stats.variance >= 0 ? TrendingUp : TrendingDown, tint: stats.variance >= 0 ? "text-emerald-600" : "text-destructive" },
    { label: "Last 7 days", value: formatCurrency(stats.total7), icon: TrendingUp, tint: "text-blue-600" },
  ];

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Daily Cash Collection</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track cash collected from shop sales and compare against recorded cash transactions.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="border-blue-100 bg-gradient-to-br from-white to-blue-50/50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`h-5 w-5 ${c.tint}`} />
            </div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="border-blue-100 p-5">
          <h2 className="mb-4 font-semibold">Record cash collection</h2>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea placeholder="e.g. Banked at CBZ, envelope A" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => add.mutate()} disabled={add.isPending}>
              {add.isPending ? "Saving…" : "Record collection"}
            </Button>
            <div className="rounded-md border border-blue-100 bg-blue-50/60 p-3 text-xs text-slate-700">
              Balance check for today: cash sales {formatCurrency(stats.cashSalesToday)} - expenses{" "}
              {formatCurrency(stats.expensesToday)} = {formatCurrency(stats.expectedToday)} expected
              against {formatCurrency(stats.todayTotal)} collected.
            </div>
            {stats.variance !== 0 && (stats.cashSalesToday > 0 || stats.expensesToday > 0) && (
              <div className={`rounded-md border p-3 text-xs ${stats.variance < 0 ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {stats.variance < 0
                  ? `Shortfall of ${formatCurrency(Math.abs(stats.variance))} against cash sales less expenses today.`
                  : `Overage of ${formatCurrency(stats.variance)} against cash sales less expenses today.`}
              </div>
            )}
          </div>
        </Card>

        <Card className="border-blue-100 p-5">
          <h2 className="mb-4 font-semibold">Recent collections</h2>
          <ul className="divide-y divide-blue-100">
            {(entries.data ?? []).map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-blue-300 text-blue-700">{e.collection_date}</Badge>
                    <span className="font-semibold">{formatCurrency(e.amount)}</span>
                  </div>
                  {e.notes && <div className="mt-1 truncate text-xs text-muted-foreground">{e.notes}</div>}
                  <div className="text-[10px] text-muted-foreground">Recorded {formatDate(e.created_at)}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
            {entries.data?.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No entries yet.</li>}
          </ul>
        </Card>
      </section>
    </div>
  );
}

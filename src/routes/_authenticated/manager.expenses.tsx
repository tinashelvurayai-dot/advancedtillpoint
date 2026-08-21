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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/manager/expenses")({
  component: ExpensesPage,
});

const CATEGORIES = ["Rent", "Utilities", "Wages", "Restock", "Transport", "Repairs", "Marketing", "Other"];

function ExpensesPage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: "Other",
    description: "",
    amount: "",
  });

  const expenses = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, expense_date, category, description, amount, created_at")
        .order("expense_date", { ascending: false })
        .limit(120);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sales = useQuery({
    queryKey: ["sales-30d"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("sales")
        .select("total_amount, created_at")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const cutoff30 = Date.now() - 30 * 24 * 3600 * 1000;
    const cutoff7 = Date.now() - 7 * 24 * 3600 * 1000;

    const exp30 = (expenses.data ?? []).filter((e) => new Date(e.expense_date).getTime() >= cutoff30);
    const exp7 = (expenses.data ?? []).filter((e) => new Date(e.expense_date).getTime() >= cutoff7);
    const totalExp30 = exp30.reduce((s, e) => s + Number(e.amount), 0);
    const totalExp7 = exp7.reduce((s, e) => s + Number(e.amount), 0);

    const rev30 = (sales.data ?? []).reduce((s, r) => s + Number(r.total_amount), 0);
    const rev7 = (sales.data ?? []).filter((r) => new Date(r.created_at).getTime() >= cutoff7).reduce((s, r) => s + Number(r.total_amount), 0);

    const profit30 = rev30 - totalExp30;
    const profit7 = rev7 - totalExp7;

    // Category breakdown
    const byCategory = new Map<string, number>();
    exp30.forEach((e) => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount)));
    const categories = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
    const maxCat = categories[0]?.[1] ?? 1;

    return { rev30, rev7, totalExp30, totalExp7, profit30, profit7, categories, maxCat };
  }, [expenses.data, sales.data]);

  const add = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(form.amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase.from("expenses").insert({
        expense_date: form.expense_date,
        category: form.category,
        description: form.description || null,
        amount: amt,
        recorded_by: session?.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense recorded");
      setForm({ ...form, description: "", amount: "" });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const cards = [
    { label: "Revenue (30d)", value: formatCurrency(stats.rev30), icon: DollarSign, tint: "text-blue-600" },
    { label: "Expenses (30d)", value: formatCurrency(stats.totalExp30), icon: Receipt, tint: "text-slate-700" },
    { label: "Profit (30d)", value: formatCurrency(stats.profit30), icon: stats.profit30 >= 0 ? TrendingUp : TrendingDown, tint: stats.profit30 >= 0 ? "text-emerald-600" : "text-destructive" },
    { label: "Profit (7d)", value: formatCurrency(stats.profit7), icon: stats.profit7 >= 0 ? TrendingUp : TrendingDown, tint: stats.profit7 >= 0 ? "text-emerald-600" : "text-destructive" },
  ];

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Expenses & Profit</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track every dollar leaving the shop and see live profit against sales.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      <section className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="border-blue-100 p-5">
          <h2 className="mb-4 font-semibold">Log expense</h2>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="e.g. Diesel for generator" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button className="w-full" onClick={() => add.mutate()} disabled={add.isPending}>
              {add.isPending ? "Saving…" : "Record expense"}
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-blue-100 p-5">
            <h2 className="mb-3 font-semibold">Spend by category (30d)</h2>
            {stats.categories.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No expenses logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.categories.map(([cat, amt]) => (
                  <li key={cat}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{cat}</span>
                      <span className="text-muted-foreground">{formatCurrency(amt)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600" style={{ width: `${(amt / stats.maxCat) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-blue-100 p-5">
            <h2 className="mb-3 font-semibold">Recent expenses</h2>
            <ul className="divide-y divide-blue-100">
              {(expenses.data ?? []).slice(0, 12).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-blue-300 text-blue-700">{e.category}</Badge>
                      <span className="font-semibold">{formatCurrency(e.amount)}</span>
                    </div>
                    {e.description && <div className="mt-1 truncate text-xs text-muted-foreground">{e.description}</div>}
                    <div className="text-[10px] text-muted-foreground">{formatDate(e.expense_date)}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </li>
              ))}
              {expenses.data?.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No expenses yet.</li>}
            </ul>
          </Card>
        </div>
      </section>
    </div>
  );
}

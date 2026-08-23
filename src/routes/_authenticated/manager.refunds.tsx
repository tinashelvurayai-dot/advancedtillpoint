import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { cachedQuery } from "@/lib/cached-query";
import { Undo2, Ban, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/manager/refunds")({
  component: RefundsPage,
});

type SaleRow = {
  id: string;
  created_at: string;
  cashier_name: string | null;
  total_amount: number;
  payment_type: string;
  status: string;
};

function RefundsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<SaleRow | null>(null);
  const [kind, setKind] = useState<"refund" | "void">("refund");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);

  const sales = useQuery({
    queryKey: ["refund-sales"],
    ...cachedQuery<SaleRow[]>("refund-sales", async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, created_at, cashier_name, total_amount, payment_type, status")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SaleRow[];
    }),
  });

  const refunds = useQuery({
    queryKey: ["refunds"],
    ...cachedQuery<any[]>("refunds", async () => {
      const { data, error } = await (supabase as any)
        .from("refunds")
        .select("id, sale_id, kind, reason, amount, restocked, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    }),
  });

  const settings = useQuery({
    queryKey: ["app-settings", "auto-approve-refunds"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("auto_approve_refunds")
        .eq("id", true)
        .maybeSingle();
      return data ?? { auto_approve_refunds: false };
    },
  });
  const autoApprove = settings.data?.auto_approve_refunds === true;

  const toggleAuto = useMutation({
    mutationFn: async (next: boolean) => {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("id", true)
        .maybeSingle();
      if (!existing) {
        const { error } = await supabase
          .from("app_settings")
          .insert({ id: true, auto_approve_refunds: next });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .update({ auto_approve_refunds: next, updated_at: new Date().toISOString() })
          .eq("id", true);
        if (error) throw error;
      }
      return next;
    },
    onSuccess: (next) => {
      toast.success(
        next
          ? "Auto-approve is on - cashiers can complete refunds themselves"
          : "Auto-approve is off - only managers can reverse a sale",
      );
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Choose a sale");
      const { error } = await (supabase as any).rpc("refund_sale", {
        p_sale_id: target.id,
        p_kind: kind,
        p_reason: reason.trim() || null,
        p_restock: restock,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(kind === "void" ? "Sale voided" : "Sale refunded");
      setTarget(null);
      setReason("");
      ["refund-sales", "refunds", "sales", "stock", "products", "cashier"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (sales.data ?? []).filter(
      (s) =>
        !q ||
        `${s.cashier_name ?? ""} ${s.payment_type} ${s.status} ${s.id}`.toLowerCase().includes(q),
    );
  }, [sales.data, search]);

  const refundTotal = (refunds.data ?? []).reduce((t: number, r: any) => t + Number(r.amount), 0);

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Refunds & Voids</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reverse a mistaken sale. A refund returns money to the customer; a void cancels a sale
          entered by mistake. Both can put the items back into stock.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Reversals recorded</div>
          <div className="mt-1 text-2xl font-bold">{refunds.data?.length ?? 0}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Value reversed</div>
          <div className="mt-1 text-2xl font-bold">{formatCurrency(refundTotal)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Recent sales loaded</div>
          <div className="mt-1 text-2xl font-bold">{sales.data?.length ?? 0}</div>
        </Card>
      </div>

      <Card
        className={`mt-6 flex flex-wrap items-center justify-between gap-4 p-5 ${autoApprove ? "border-emerald-200 bg-emerald-50" : ""}`}
      >
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className={`h-4 w-4 ${autoApprove ? "text-emerald-600" : "text-muted-foreground"}`} />
            Auto-approve refunds
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch this on when you are away or in a meeting. Cashiers can then complete a refund or
            void from their own Refunds page and it goes through immediately, with stock returned
            and the sale removed from the day&apos;s takings. Switch it off and only you can reverse
            a sale.
          </p>
        </div>
        <Switch
          checked={autoApprove}
          disabled={toggleAuto.isPending}
          onCheckedChange={(v) => toggleAuto.mutate(v)}
          aria-label="Auto-approve refunds"
        />
      </Card>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by cashier, payment or status"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          <ul className="divide-y divide-border">
            {filtered.map((s) => {
              const reversed = s.status === "refunded" || s.status === "voided";
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium">
                      {formatDate(s.created_at)} · {s.cashier_name ?? "Cashier"}
                    </div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {s.payment_type} · {s.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(s.total_amount)}
                    </span>
                    {reversed ? (
                      <Badge variant="outline" className="capitalize">
                        {s.status}
                      </Badge>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTarget(s);
                            setKind("refund");
                            setRestock(true);
                          }}
                        >
                          <Undo2 className="mr-2 h-4 w-4" /> Refund
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTarget(s);
                            setKind("void");
                            setRestock(true);
                          }}
                        >
                          <Ban className="mr-2 h-4 w-4" /> Void
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">No sales found.</li>
            )}
          </ul>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="mb-3 font-semibold">Reversal history</h2>
        <ul className="divide-y divide-border text-sm">
          {(refunds.data ?? []).map((r: any) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <span className="font-medium capitalize">{r.kind}</span>{" "}
                <span className="text-muted-foreground">{formatDate(r.created_at)}</span>
                {r.reason && <div className="text-xs text-muted-foreground">{r.reason}</div>}
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums">{formatCurrency(r.amount)}</div>
                <div className="text-xs text-muted-foreground">
                  {r.restocked ? "stock returned" : "stock not returned"}
                </div>
              </div>
            </li>
          ))}
          {(refunds.data ?? []).length === 0 && (
            <li className="py-6 text-center text-muted-foreground">Nothing reversed yet.</li>
          )}
        </ul>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{kind === "void" ? "Void sale" : "Refund sale"}</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                {formatDate(target.created_at)} · {target.cashier_name ?? "Cashier"} ·{" "}
                <span className="font-semibold">{formatCurrency(target.total_amount)}</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Wrong item, customer returned goods, entered twice..."
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Return items to stock</div>
                  <div className="text-xs text-muted-foreground">
                    Adds the sold quantities back to each product.
                  </div>
                </div>
                <Switch checked={restock} onCheckedChange={setRestock} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
              {apply.isPending ? "Working..." : kind === "void" ? "Void sale" : "Refund sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

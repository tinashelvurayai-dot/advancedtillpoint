import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { ArrowLeft, Undo2, Ban, Search, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/refunds")({
  component: CashierRefundsPage,
  head: () => ({
    meta: [
      { title: "Refunds · TillPoint Till" },
      {
        name: "description",
        content: "Reverse a mistaken sale from the till when the manager allows auto-approved refunds.",
      },
      { property: "og:title", content: "Refunds · TillPoint Till" },
      {
        property: "og:description",
        content: "Cashier refunds and voids, kept in step with stock and the sales ledger.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type SaleRow = {
  id: string;
  created_at: string;
  cashier_name: string | null;
  total_amount: number;
  payment_type: string;
  status: string;
};

function CashierRefundsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<SaleRow | null>(null);
  const [kind, setKind] = useState<"refund" | "void">("refund");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  // sale_item_id -> quantity being returned
  const [picked, setPicked] = useState<Record<string, number>>({});

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

  const sales = useQuery({
    queryKey: ["cashier-refund-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, created_at, cashier_name, total_amount, payment_type, status")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as SaleRow[];
    },
  });

  // The lines of the chosen sale, with whatever is still refundable on each.
  const lines = useQuery({
    queryKey: ["refund-sale-lines", target?.id],
    enabled: !!target,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select(
          "id, quantity, unit_price, variant_id, product_variants(variant_name, products(name))",
        )
        .eq("sale_id", target!.id);
      if (error) throw error;
      const items = (data ?? []) as unknown as Array<{
        id: string;
        quantity: number;
        unit_price: number;
        product_variants: { variant_name: string; products: { name: string } | null } | null;
      }>;
      const { data: done } = await supabase
        .from("refund_items")
        .select("sale_item_id, quantity")
        .in(
          "sale_item_id",
          items.map((i) => i.id),
        );
      const already = new Map<string, number>();
      for (const r of (done ?? []) as Array<{ sale_item_id: string; quantity: number }>) {
        already.set(r.sale_item_id, (already.get(r.sale_item_id) ?? 0) + Number(r.quantity));
      }
      return items.map((i) => ({
        id: i.id,
        name: i.product_variants?.products?.name ?? "Item",
        variant: i.product_variants?.variant_name ?? "",
        unit_price: Number(i.unit_price),
        remaining: Number(i.quantity) - (already.get(i.id) ?? 0),
      }));
    },
  });

  // Default to returning everything that is still refundable.
  useEffect(() => {
    if (!lines.data) return;
    setPicked(Object.fromEntries(lines.data.map((l) => [l.id, l.remaining])));
  }, [lines.data]);

  const refundTotal = (lines.data ?? []).reduce(
    (sum, l) => sum + (picked[l.id] ?? 0) * l.unit_price,
    0,
  );

  const apply = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Choose a sale");
      const items = (lines.data ?? [])
        .filter((l) => (picked[l.id] ?? 0) > 0)
        .map((l) => ({ sale_item_id: l.id, quantity: picked[l.id] }));
      if (kind === "refund" && items.length === 0) throw new Error("Choose at least one item");
      const { error } = await supabase.rpc("refund_sale_items", {
        p_sale_id: target.id,
        p_kind: kind,
        p_reason: reason.trim() || undefined,
        p_restock: restock,
        // A void always reverses the whole sale.
        p_items: kind === "void" ? undefined : items,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(kind === "void" ? "Sale voided" : "Sale refunded");
      setTarget(null);
      setReason("");
      ["cashier-refund-sales", "refund-sales", "refunds", "sales", "stock", "cashier"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (sales.data ?? []).filter(
      (s) => !q || `${s.cashier_name ?? ""} ${s.payment_type} ${s.status}`.toLowerCase().includes(q),
    );
  }, [sales.data, search]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Refunds</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Reverse a sale you entered by mistake, or give a customer their money back. Every
            reversal here appears on the manager&apos;s Refunds &amp; Voids page and is removed from
            the day&apos;s sales totals.
          </p>
        </div>
        <Link to="/cashier">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to till
          </Button>
        </Link>
      </header>

      <Card
        className={`mb-6 flex items-start gap-3 p-4 ${autoApprove ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
      >
        {autoApprove ? (
          <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
        ) : (
          <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" />
        )}
        <div className="text-sm">
          <div className="font-semibold">
            {autoApprove ? "Auto-approve refunds is ON" : "Refunds need manager approval"}
          </div>
          <p className="text-muted-foreground">
            {autoApprove
              ? "You can complete a refund or void on your own. It is recorded with your name."
              : "The manager has to carry out reversals, or switch auto-approve on from Refunds & Voids."}
          </p>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by payment or status"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
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
                        disabled={!autoApprove}
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
                        disabled={!autoApprove}
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
            <li className="py-8 text-center text-sm text-muted-foreground">
              {sales.isLoading ? "Loading sales..." : "No sales found."}
            </li>
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
                {formatDate(target.created_at)} ·{" "}
                <span className="font-semibold">{formatCurrency(target.total_amount)}</span>
              </div>

              {kind === "refund" && (
                <div className="space-y-2">
                  <Label>Which items are coming back?</Label>
                  <p className="text-xs text-muted-foreground">
                    Set the quantity for each item. Leave an item at 0 if the customer is keeping
                    it.
                  </p>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {(lines.data ?? []).map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {l.name} {l.variant && <span className="text-muted-foreground">· {l.variant}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(l.unit_price)} each · {l.remaining} refundable
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() =>
                              setPicked((p) => ({ ...p, [l.id]: Math.max(0, (p[l.id] ?? 0) - 1) }))
                            }
                          >
                            −
                          </Button>
                          <span className="w-6 text-center text-sm font-semibold tabular-nums">
                            {picked[l.id] ?? 0}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() =>
                              setPicked((p) => ({
                                ...p,
                                [l.id]: Math.min(l.remaining, (p[l.id] ?? 0) + 1),
                              }))
                            }
                          >
                            +
                          </Button>
                        </div>
                      </li>
                    ))}
                    {lines.isLoading && (
                      <li className="p-3 text-sm text-muted-foreground">Loading items...</li>
                    )}
                  </ul>
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
                    <span>Amount to refund</span>
                    <span className="font-semibold">{formatCurrency(refundTotal)}</span>
                  </div>
                </div>
              )}

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

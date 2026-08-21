import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { ClipboardList, Plus, Check, Trash2, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useEffect, useState } from "react";
import { isManagerMode } from "@/lib/session-mode";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
});

// Parses "2x 1kg Salt Red Seal" -> { quantity: 2, unit: "1kg", product_name: "Salt Red Seal" }
function parseEntry(raw: string): {
  quantity: number | null;
  unit: string | null;
  product_name: string;
} {
  const trimmed = raw.trim();
  // Try "Nx UNIT PRODUCT" or "N UNIT PRODUCT" or "Nx PRODUCT"
  const m = trimmed.match(/^(\d+)\s*x?\s+(\S+)?\s*(.+)?$/i);
  if (!m) return { quantity: null, unit: null, product_name: trimmed };
  const quantity = Number(m[1]);
  const rest = (m[3] ?? "").trim();
  // If m[2] looks like a unit (contains digits or common suffix), keep it separate
  const maybeUnit = m[2] ?? "";
  const isUnit =
    /\d/.test(maybeUnit) || /^(kg|g|ml|l|lt|pcs|pack|packs|box|boxes)$/i.test(maybeUnit);
  return {
    quantity,
    unit: isUnit ? maybeUnit : null,
    product_name: isUnit ? rest : `${maybeUnit} ${rest}`.trim() || trimmed,
  };
}

function OrdersPage() {
  const [manager, setManager] = useState(false);
  useEffect(() => {
    setManager(isManagerMode());
  }, []);
  const qc = useQueryClient();
  const { session, role } = useAuth();
  const [entry, setEntry] = useState("");
  const [notes, setNotes] = useState("");

  const orders = useQuery({
    queryKey: ["restock-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restock_orders")
        .select(
          "id, entry, quantity, unit, product_name, status, requested_at, fulfilled_at, notes, requested_by",
        )
        .order("requested_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!entry.trim()) throw new Error("Enter an item");
      const parsed = parseEntry(entry);
      const { error } = await supabase.from("restock_orders").insert({
        entry: entry.trim(),
        quantity: parsed.quantity,
        unit: parsed.unit,
        product_name: parsed.product_name,
        notes: notes || null,
        requested_by: session?.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to orders");
      setEntry("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["restock-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fulfill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("restock_orders")
        .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["restock-orders"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restock_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["restock-orders"] }),
  });

  const pending = (orders.data ?? []).filter((o) => o.status !== "fulfilled");
  const done = (orders.data ?? []).filter((o) => o.status === "fulfilled");

  const backTo = manager || role === "manager" ? "/manager" : "/cashier";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div className="hidden sm:block border-l border-blue-100 pl-3">
            <div className="text-xs font-medium uppercase tracking-wider text-blue-700">
              Restock Orders
            </div>
            <div className="text-sm text-muted-foreground">Items that have run out</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={backTo}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          <SignOutButton variant="outline" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-4 md:p-10">
        <Card className="mb-6 border-blue-200 bg-gradient-to-br from-white to-blue-50/50 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold">Add an item that has run out</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Use the format:{" "}
            <span className="font-mono font-semibold text-blue-700">2x 1kg Salt Red Seal</span>. The
            system parses quantity, unit, and product name automatically and timestamps the entry.
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <Input
              placeholder="e.g. 2x 1kg Salt Red Seal"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !add.isPending && add.mutate()}
              className="text-base"
            />
            <Button onClick={() => add.mutate()} disabled={add.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
          <Textarea
            placeholder="Optional notes (supplier, urgency, etc.)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2"
          />
        </Card>

        <Card className="border-blue-100 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Pending ({pending.length})</h2>
            <Badge variant="outline" className="border-blue-300 text-blue-700">
              Live
            </Badge>
          </div>
          <ul className="divide-y divide-blue-100">
            {pending.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {o.quantity && <Badge className="bg-blue-600 text-white">{o.quantity}x</Badge>}
                    {o.unit && (
                      <Badge variant="outline" className="border-blue-300 text-blue-700">
                        {o.unit}
                      </Badge>
                    )}
                    <span className="truncate font-medium">{o.product_name || o.entry}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Added {formatDate(o.requested_at)}
                  </div>
                  {o.notes && (
                    <div className="mt-1 text-xs italic text-muted-foreground">{o.notes}</div>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {role === "manager" && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => fulfill.mutate(o.id)}
                        title="Mark fulfilled"
                      >
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(o.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
            {pending.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Nothing pending. Everything's in stock.
              </li>
            )}
          </ul>
        </Card>

        {done.length > 0 && (
          <Card className="mt-6 border-blue-100 p-5">
            <h2 className="mb-4 font-semibold text-muted-foreground">Fulfilled ({done.length})</h2>
            <ul className="divide-y divide-blue-100">
              {done.slice(0, 20).map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm text-muted-foreground"
                >
                  <span className="truncate line-through">{o.entry}</span>
                  <span className="text-xs">
                    {o.fulfilled_at ? formatDate(o.fulfilled_at) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

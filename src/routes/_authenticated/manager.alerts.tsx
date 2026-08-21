import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { AlertTriangle, PackageX } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manager/alerts")({
  component: LowStockAlerts,
});

type Row = {
  quantity: number;
  low_stock_alert_level: number;
  updated_at: string;
  variant: {
    id: string;
    variant_name: string;
    size: string | null;
    product: { name: string; category: string | null } | null;
  } | null;
};

function LowStockAlerts() {
  const q = useQuery({
    queryKey: ["manager", "low-stock-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock")
        .select("quantity, low_stock_alert_level, updated_at, variant:product_variants(id, variant_name, size, product:products(name, category))")
        .order("quantity", { ascending: true });
      if (error) throw error;
      return (data as unknown as Row[]).filter((r) => r.variant && r.quantity <= r.low_stock_alert_level);
    },
  });

  const rows = q.data ?? [];
  const empty = rows.filter((r) => r.quantity <= 0);

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Low stock alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Products are logged here automatically once their remaining units reach the minimum threshold.
        </p>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Items at or below threshold</span>
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="mt-2 text-3xl font-bold">{rows.length}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Completely finished</span>
            <PackageX className="h-5 w-5 text-destructive" />
          </div>
          <div className="mt-2 text-3xl font-bold">{empty.length}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Variant</th>
              <th className="px-4 py-3">Units left</th>
              <th className="px-4 py-3">Threshold</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Logged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No products have reached their minimum threshold.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.variant!.id} className={r.quantity <= 0 ? "bg-destructive/5" : ""}>
                <td className="px-4 py-3 font-medium">{r.variant?.product?.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.variant?.variant_name}{r.variant?.size ? ` - ${r.variant.size}` : ""}</td>
                <td className="px-4 py-3 font-semibold">{r.quantity}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.low_stock_alert_level}</td>
                <td className="px-4 py-3">
                  {r.quantity <= 0
                    ? <Badge variant="destructive">Finished</Badge>
                    : <Badge variant="outline" className="border-amber-300 text-amber-700">Running low</Badge>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(r.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

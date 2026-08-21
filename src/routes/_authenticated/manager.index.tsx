import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { DollarSign, ShoppingBag, Package, AlertTriangle, BadgePercent } from "lucide-react";
import { SyncIndicator, useSyncState } from "@/components/sync-indicator";
import { readLog, subscribeLog, type TxLogEntry } from "@/lib/transaction-log";
import { getQueue, subscribeQueue, type QueuedSale } from "@/lib/offline-queue";

function PendingSyncNotice() {
  const { pending, lastSync } = useSyncState();
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <SyncIndicator />
      <div className="text-xs text-muted-foreground">
        {pending > 0
          ? `${pending} offline sale${pending === 1 ? "" : "s"} still waiting to upload.`
          : lastSync
            ? `All sales uploaded · last sync ${new Date(lastSync).toLocaleTimeString()}`
            : "All sales uploaded."}
      </div>
    </div>
  );
}

function SyncOverview() {
  const [log, setLog] = useState<TxLogEntry[]>([]);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  useEffect(() => {
    setQueue(getQueue());
    const offLog = subscribeLog(setLog);
    const offQueue = subscribeQueue(() => setQueue(getQueue()));
    return () => {
      offLog();
      offQueue();
    };
  }, []);

  const synced = log.filter((e) => e.status === "synced");
  const offline = log.filter((e) => e.status !== "synced");
  const failed = queue.filter((q) => q.status === "failed").length;
  const pending = queue.length - failed;

  const tiles = [
    { label: "Synced sales", value: synced.length },
    { label: "Offline sales on device", value: offline.length },
    { label: "Pending upload", value: pending },
    { label: "Failed upload", value: failed },
  ];

  return (
    <section className="mb-8 rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Synchronization</h2>
        <Link to="/sync">
          <Button variant="outline" size="sm">
            Open sync queue
          </Button>
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className="mt-1 text-2xl font-bold">{t.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export const Route = createFileRoute("/_authenticated/manager/")({
  component: ManagerDashboard,
});

function SystemPriceBanner() {
  const navigate = useNavigate();
  const [taps, setTaps] = useState(0);
  const original = 370;
  const current = 170;
  const savings = original - current;
  const pct = Math.round((savings / original) * 100);
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-blue-600 via-indigo-600 to-fuchsia-600 p-6 text-white shadow-[var(--shadow-elev-2)] md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <h2 className="text-2xl font-bold md:text-3xl">System Price</h2>

          <p className="mt-1 max-w-xl text-sm text-white/80">
            Full TillPoint Retail OS - variant inventory, dual-role dashboards, offline till, live
            analytics, AI forecasting and more. One-time price.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-medium text-white/60 line-through">${original}</span>
            <button
              type="button"
              className="text-5xl font-extrabold tracking-tight"
              onClick={() => {
                const next = taps + 1;
                setTaps(next);
                if (next >= 10) {
                  setTaps(0);
                  void navigate({ to: "/manager/agreement" });
                }
              }}
              aria-label="Open handover agreement"
            >
              ${current}
            </button>
            <span className="text-sm font-semibold text-white/80">USD</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/90 px-3 py-1 text-xs font-bold uppercase text-emerald-950">
            <BadgePercent className="h-3.5 w-3.5" /> Save ${savings} · {pct}% off
          </div>
        </div>
      </div>
    </section>
  );
}

function ManagerDashboard() {
  const [shopName, setShopName] = useState("Green Shop");
  useEffect(() => {
    const read = () => {
      try {
        setShopName(
          (JSON.parse(localStorage.getItem("tillpoint.manager.settings.v1") ?? "{}")
            .shopName as string) || "Green Shop",
        );
      } catch {
        /* noop */
      }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);
  const stats = useQuery({
    queryKey: ["manager", "dashboard"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [salesToday, allSales, products, lowStock, recentSales] = await Promise.all([
        supabase.from("sales").select("total_amount").gte("created_at", today.toISOString()),
        supabase.from("sales").select("total_amount"),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase
          .from("stock")
          .select(
            "quantity, low_stock_alert_level, variant:product_variants(id, variant_name, product:products(name))",
          )
          .order("quantity"),
        supabase
          .from("sales")
          .select(
            "id, total_amount, payment_type, created_at, cashier_name",
          )
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      const todayTotal = (salesToday.data ?? []).reduce((s, r) => s + Number(r.total_amount), 0);
      const total = (allSales.data ?? []).reduce((s, r) => s + Number(r.total_amount), 0);
      const low = (lowStock.data ?? []).filter((s) => s.quantity <= s.low_stock_alert_level);
      return {
        todayTotal,
        todayCount: salesToday.data?.length ?? 0,
        total,
        productsCount: products.count ?? 0,
        lowStock: low,
        recent: recentSales.data ?? [],
      };
    },
  });

  const cards = [
    {
      label: "Today's revenue",
      value: formatCurrency(stats.data?.todayTotal ?? 0),
      icon: DollarSign,
      tint: "text-primary",
    },
    {
      label: "Today's sales",
      value: String(stats.data?.todayCount ?? 0),
      icon: ShoppingBag,
      tint: "text-primary",
    },
    {
      label: "Products",
      value: String(stats.data?.productsCount ?? 0),
      icon: Package,
      tint: "text-primary",
    },
    {
      label: "Low stock alerts",
      value: String(stats.data?.lowStock.length ?? 0),
      icon: AlertTriangle,
      tint: stats.data && stats.data.lowStock.length > 0 ? "text-destructive" : "text-primary",
    },
  ];

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{shopName} Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live snapshot of your shop.</p>
      </header>

      <PendingSyncNotice />

      <SystemPriceBanner />

      <SyncOverview />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className={`h-5 w-5 ${c.tint}`} />
            </div>
            <div className="mt-2 text-3xl font-bold">{c.value}</div>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Recent sales</h2>
          <ul className="divide-y divide-border">
            {stats.data?.recent.length ? (
              stats.data.recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">
                      {(s as any).cashier_name ?? "Cashier"} ·{" "}
                      <span className="capitalize text-muted-foreground">{s.payment_type}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(s.created_at)}</div>
                  </div>
                  <div className="font-semibold">{formatCurrency(s.total_amount)}</div>
                </li>
              ))
            ) : (
              <li className="py-6 text-center text-sm text-muted-foreground">No sales yet.</li>
            )}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Low stock</h2>
          <ul className="divide-y divide-border">
            {stats.data?.lowStock.length ? (
              stats.data.lowStock.slice(0, 8).map((s: any) => (
                <li key={s.variant?.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">{s.variant?.product?.name}</div>
                    <div className="text-xs text-muted-foreground">{s.variant?.variant_name}</div>
                  </div>
                  <div
                    className={`text-sm font-semibold ${s.quantity === 0 ? "text-destructive" : "text-warning"}`}
                  >
                    {s.quantity} left
                  </div>
                </li>
              ))
            ) : (
              <li className="py-6 text-center text-sm text-muted-foreground">
                All stock levels healthy.
              </li>
            )}
          </ul>
        </Card>
      </section>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useOnline } from "@/hooks/use-online";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignOutButton } from "@/components/sign-out-button";
import { ManagerGateLogo } from "@/components/manager-gate-logo";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  ShoppingCart,
  Search,
  Trash2,
  Plus,
  Minus,
  Package as PackageIcon,
  BookOpen,
  ClipboardList,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock as LockIcon,
} from "lucide-react";
import { enqueueSale, flushQueue, getQueue } from "@/lib/offline-queue";
import {
  appendLog,
  hydrateLogFromIdb,
  subscribeLog,
  type TxLogEntry,
} from "@/lib/transaction-log";
import { computeSalesToday, subscribeSalesTodayMarker } from "@/lib/sales-today";
import { SyncAlertBanner } from "@/components/sync-alert-banner";
import { printReceipt, downloadReceipt, receiptText, receiptNumber } from "@/lib/receipt";
import { runSync } from "@/lib/sync-manager";
import { recordSaleDelta, hydrateStockDeltas } from "@/lib/local-stock";
import { CASHIER_NAME, setMode, isManagerMode } from "@/lib/session-mode";

import { IDB_KEYS, idbGet, idbSet } from "@/lib/offline-db";
import { SyncIndicator } from "@/components/sync-indicator";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { useHideImages } from "@/hooks/use-hide-images";

export const Route = createFileRoute("/_authenticated/cashier")({
  component: CashierScreen,
});

type Variant = {
  id: string;
  variant_name: string;
  size: string | null;
  flavour: string | null;
  price: number;
  image_url: string | null;
  active: boolean;
  product: { id: string; name: string; category: string | null; image_url: string | null } | null;
  stock: { quantity: number; available?: boolean } | null;
};

type CartLine = { variant: Variant; qty: number };
type SyncStatus = "idle" | "syncing" | "synced" | "failed";

const OFFLINE_CACHE_KEY = "tillpoint.cashier.catalog.v1";

function CashierScreen() {
  const { profile, session, loading } = useAuth();
  const offlineCashierId = "offline-cashier";
  const qc = useQueryClient();
  const online = useOnline();
  const [hideImages] = useHideImages();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<"cash" | "mobile" | "other">("cash");
  const [checkingOut, setCheckingOut] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [queuedCount, setQueuedCount] = useState<number>(() => getQueue().length);
  // Today's takings, read from the local transaction log so the figure is
  // correct even with no connection.
  const [today, setToday] = useState({ total: 0, count: 0 });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [receipt, setReceipt] = useState<{
    entry: TxLogEntry;
    amountPaid: number;
    change: number;
  } | null>(null);
  const [roleIdentity, setRoleIdentity] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tillpoint.manager.settings.v1") ?? "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const onSettings = (event: StorageEvent) => {
      if (event.key !== "tillpoint.manager.settings.v1") return;
      try {
        setRoleIdentity(JSON.parse(event.newValue ?? "{}"));
      } catch {
        /* noop */
      }
    };
    window.addEventListener("storage", onSettings);
    return () => window.removeEventListener("storage", onSettings);
  }, []);

  useEffect(() => {
    // Durable offline history lives in IndexedDB; pull it in so the header is
    // right after a reload with no connection.
    void hydrateLogFromIdb();
    let latest: TxLogEntry[] = [];
    const recompute = () => setToday(computeSalesToday(latest));
    const offLog = subscribeLog((list) => {
      latest = list;
      recompute();
    });
    const offMarker = subscribeSalesTodayMarker(recompute);
    return () => {
      offLog();
      offMarker();
    };
  }, []);

  const variants = useQuery({
    queryKey: ["cashier", "variants"],
    placeholderData: () => {
      try {
        const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
        return raw ? (JSON.parse(raw) as Variant[]) : undefined;
      } catch {
        return undefined;
      }
    },
    queryFn: async () => {
      if (!online) throw new Error("Offline");
      const { data, error } = await supabase
        .from("product_variants")
        .select(
          "id, variant_name, size, flavour, price, image_url, active, product:products(id, name, category, image_url), stock(quantity, available)",
        )
        .eq("active", true)
        .order("variant_name");
      if (error) throw error;
      const list = (data as unknown as Variant[]).filter((v) => v.product);
      try {
        localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(list));
      } catch {
        /* noop */
      }
      void idbSet(IDB_KEYS.catalog, list);
      return list;
    },
  });

  const [idbCatalog, setIdbCatalog] = useState<Variant[]>([]);
  useEffect(() => {
    void idbGet<Variant[]>(IDB_KEYS.catalog).then((c) => {
      if (c?.length) setIdbCatalog(c);
    });
    // Opening the till switches to cashier mode, but a manager keeps their access.
    if (!isManagerMode()) setMode("cashier");
    void hydrateStockDeltas();
  }, []);

  const offlineList = useMemo<Variant[]>(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Variant[]) : [];
      return parsed.length ? parsed : idbCatalog;
    } catch {
      return idbCatalog;
    }
  }, [variants.data, idbCatalog]);

  const list: Variant[] = variants.data ?? offlineList;

  const settings = useQuery({
    queryKey: ["cashier", "settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("show_cashier_manual")
        .eq("id", true)
        .maybeSingle();
      return data ?? { show_cashier_manual: true };
    },
  });

  const hasSearch = search.trim().length > 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [] as Variant[];
    return list.filter(
      (v) =>
        v.variant_name.toLowerCase().includes(q) ||
        v.product?.name.toLowerCase().includes(q) ||
        v.product?.category?.toLowerCase().includes(q),
    );
  }, [search, list]);

  const subtotal = cart.reduce((s, l) => s + Number(l.variant.price) * l.qty, 0);

  const syncOfflineQueue = useCallback(
    async (showEmptyToast = false) => {
      if (!online) {
        toast.error("You are offline. Sync will start when the connection returns.");
        return;
      }
      const q = getQueue();
      setQueuedCount(q.length);
      if (q.length === 0) {
        setSyncStatus("synced");
        setLastSync(new Date().toISOString());
        if (showEmptyToast) toast.success("Everything is synced");
        return;
      }
      setSyncStatus("syncing");
      toast.info(`Syncing ${q.length} offline sale${q.length === 1 ? "" : "s"}...`);
      const res = await flushQueue();
      const remaining = getQueue().length;
      setQueuedCount(remaining);
      setLastSync(new Date().toISOString());
      if (res.failed > 0) {
        setSyncStatus("failed");
        toast.error(`${res.failed} sale${res.failed === 1 ? "" : "s"} could not sync - will retry`);
      } else {
        setSyncStatus("synced");
        if (res.ok > 0) toast.success(`${res.ok} offline sale${res.ok === 1 ? "" : "s"} synced`);
      }
      qc.invalidateQueries({ queryKey: ["cashier"] });
    },
    [online, qc],
  );

  // Auto-sync queued sales when back online
  useEffect(() => {
    if (!online) {
      setSyncStatus(getQueue().length > 0 ? "idle" : "synced");
      return;
    }
    qc.invalidateQueries({ queryKey: ["cashier"] });
    void syncOfflineQueue(false);
  }, [online, qc, syncOfflineQueue]);

  function addToCart(v: Variant) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variant.id === v.id);
      if (existing) return prev.map((l) => (l.variant.id === v.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { variant: v, qty: 1 }];
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.variant.id !== id) return [l];
        const next = l.qty + delta;
        if (next <= 0) return [];
        return [{ ...l, qty: next }];
      }),
    );
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.variant.id !== id));
  }

  function cancelSale() {
    if (cart.length === 0) return;
    if (!confirm("Cancel this sale and clear the receipt?")) return;
    setCart([]);
    toast.info("Sale cancelled");
  }

  function findVariantByPhrase(phrase: string): Variant | null {
    const q = phrase.toLowerCase().trim();
    if (!q) return null;
    const scored = list
      .map((v) => {
        const hay =
          `${v.product?.name ?? ""} ${v.variant_name} ${v.size ?? ""} ${v.flavour ?? ""}`.toLowerCase();
        let score = 0;
        for (const w of q.split(/\s+/).filter(Boolean)) if (hay.includes(w)) score++;
        return { v, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored[0]?.v ?? null;
  }

  function handleVoice(raw: string) {
    const text = raw
      .toLowerCase()
      .trim()
      .replace(/[.,!?]/g, "");
    if (!text) return;

    // "new" / "new sale" / "clear" -> reset cart
    if (/^(new( sale)?|clear|reset)$/.test(text)) {
      setCart([]);
      toast.info("Cart cleared");
      return;
    }
    // "checkout" / "complete sale" / "pay"
    if (/^(checkout|complete( sale)?|pay|finish)$/.test(text)) {
      if (cart.length === 0) return toast.error("Cart is empty");
      checkout.mutate();
      return;
    }
    // "cash" / "mobile" / "ecocash"
    if (/^cash$/.test(text)) {
      setPayment("cash");
      toast.info("Payment: Cash");
      return;
    }
    if (/^(mobile|ecocash|eco cash)$/.test(text)) {
      setPayment("mobile");
      toast.info("Payment: EcoCash / Mobile");
      return;
    }

    // "remove <phrase>" -> remove matching cart line
    const rm = text.match(/^remove\s+(.+)$/);
    if (rm) {
      const line = cart.find((l) =>
        `${l.variant.product?.name} ${l.variant.variant_name}`.toLowerCase().includes(rm[1]),
      );
      if (line) {
        removeLine(line.variant.id);
        toast.success(`Removed ${line.variant.product?.name}`);
      } else toast.error(`Not in cart: ${rm[1]}`);
      return;
    }
    // "search <phrase>"
    const sr = text.match(/^(search|find)\s+(.+)$/);
    if (sr) {
      setSearch(sr[2]);
      return;
    }

    // "add <n> <phrase>" or "<n> <phrase>" or "add <phrase>"
    const addN = text.match(/^(?:add\s+)?(\d+)\s+(.+)$/);
    const addPhrase = text.match(/^add\s+(.+)$/);
    let qty = 1;
    let phrase = text;
    if (addN) {
      qty = Math.max(1, parseInt(addN[1], 10));
      phrase = addN[2];
    } else if (addPhrase) {
      phrase = addPhrase[1];
    }

    const v = findVariantByPhrase(phrase);
    if (!v) {
      setSearch(phrase);
      toast.info(`Searching "${phrase}"`);
      return;
    }
    for (let i = 0; i < qty; i++) addToCart(v);
    toast.success(`Added ${qty} × ${v.product?.name}`);
  }

  const checkout = useMutation<{ entry: TxLogEntry }, Error, void>({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Cart is empty");

      const items = cart.map((l) => ({
        variant_id: l.variant.id,
        quantity: l.qty,
        unit_price: Number(l.variant.price),
        subtotal: Number(l.variant.price) * l.qty,
      }));
      const logItems = cart.map((l) => ({
        name: l.variant.product?.name ?? l.variant.variant_name,
        variant: l.variant.variant_name,
        quantity: l.qty,
        unit_price: Number(l.variant.price),
        subtotal: Number(l.variant.price) * l.qty,
      }));
      const cashierName = profile?.full_name ?? CASHIER_NAME;
      const saleId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

      // LOCAL FIRST: the sale is committed to this device before anything else.
      // The till never waits for the cloud, so a sale can never hang on the network.
      const entry = enqueueSale({
        id: saleId,
        cashier_id: session?.user.id ?? offlineCashierId,
        cashier_name: cashierName,
        total_amount: subtotal,
        payment_type: payment,
        items,
      });
      const logEntry = appendLog({
        id: entry.id,
        created_at: entry.queued_at,
        total: subtotal,
        payment_type: payment,
        cashier_name: cashierName,
        items: logItems,
        status: "queued",
      });
      // Reduce on-hand counts locally right away so offline stock stays accurate.
      recordSaleDelta(entry.id, items);
      setQueuedCount(getQueue().length);

      return Promise.resolve({ entry: logEntry });
    },
    onMutate: () => setCheckingOut(true),
    onSettled: () => setCheckingOut(false),
    onSuccess: (res) => {
      const paid = Number(amountPaid);
      setReceipt({
        entry: res.entry,
        amountPaid: Number.isFinite(paid) && paid > 0 ? paid : subtotal,
        change: Number.isFinite(paid) && paid > subtotal ? paid - subtotal : 0,
      });
      toast.success(
        online
          ? `Sale completed - ${formatCurrency(res.entry.total)}`
          : `Sale saved on this device - ${formatCurrency(res.entry.total)}`,
      );
      setCart([]);
      setAmountPaid("");
      // Background upload; failures simply stay queued and retry automatically.
      if (typeof navigator === "undefined" || navigator.onLine) {
        void runSync().then(() => {
          setQueuedCount(getQueue().length);
          setLastSync(new Date().toISOString());
          qc.invalidateQueries({ queryKey: ["cashier"] });
        });
      }
    },

    onError: (e: Error) => toast.error(e.message),
  });

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  // Cashier mode is always allowed here; the manager reaches their console
  // through the secret code gate instead of an automatic redirect.

  const showManual = settings.data?.show_cashier_manual !== false;

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <ManagerGateLogo />
            <div className="hidden sm:block border-l border-border pl-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Green Shop · Cashier
              </div>
              <div className="text-sm font-semibold">
                {roleIdentity.cashierName ?? profile?.full_name ?? "Cashier"}
              </div>
              <div className="text-xs text-muted-foreground">
                {roleIdentity.cashierTitle ?? "Cashier"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-right">
              <div className="text-[10px] font-medium uppercase tracking-wider text-blue-700">
                Sales today
              </div>
              <div className="text-base font-bold tabular-nums text-blue-950">
                {formatCurrency(today.total)}
              </div>
              <div className="text-[10px] text-blue-700">
                {today.count} sale{today.count === 1 ? "" : "s"}
              </div>
            </div>
            <SyncIndicator />
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncOfflineQueue(true)}
              disabled={!online || syncStatus === "syncing"}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`}
              />{" "}
              Sync
            </Button>
            <PWAInstallButton variant="outline" size="sm" label="Install" />
            <Link to="/transactions">
              <Button variant="outline" size="sm">
                <ClipboardList className="mr-2 h-4 w-4" /> Transaction log
              </Button>
            </Link>
            <Link to="/sync">
              <Button variant="outline" size="sm">
                Sync queue
              </Button>
            </Link>

            <Link to="/shift">
              <Button variant="outline" size="sm">
                <LockIcon className="mr-2 h-4 w-4" /> Shift close
              </Button>
            </Link>

            <Link to="/orders">
              <Button variant="outline" size="sm">
                <ClipboardList className="mr-2 h-4 w-4" /> Orders
              </Button>
            </Link>

            {showManual && (
              <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
                <BookOpen className="mr-2 h-4 w-4" /> Manual
              </Button>
            )}
            <SignOutButton variant="outline" />
          </div>
        </header>

        <SyncAlertBanner />

        <div
          className={`border-b px-4 py-3 text-xs sm:px-6 ${online ? "border-blue-100 bg-blue-50 text-blue-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {syncStatus === "syncing" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : online ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span className="font-medium">
                {!online
                  ? "Offline mode active - sales are saved on this device."
                  : syncStatus === "syncing"
                    ? "Syncing offline sales now..."
                    : queuedCount > 0
                      ? `${queuedCount} offline sale${queuedCount === 1 ? "" : "s"} waiting to sync.`
                      : "Online and synced."}
              </span>
            </div>
            <span className="text-muted-foreground">
              {lastSync
                ? `Last sync: ${new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Catalog is available after it loads once."}
            </span>
          </div>
        </div>

        <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="cashier-search"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-10"
            />
            {search.length > 0 && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  document.getElementById("cashier-search")?.focus();
                }}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {!hasSearch ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Search className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Search to find a product</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Products stay hidden until you type a name, variant or category.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <PackageIcon className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No products found.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((v) => {
                const image = v.image_url || v.product?.image_url;
                return (
                  <div key={v.id} className="relative">
                    <button
                      onClick={() => addToCart(v)}
                      className="group w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-[var(--shadow-elev-1)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elev-2)]"
                    >
                      {!hideImages && (
                        <div className="aspect-square overflow-hidden bg-accent">
                          {image ? (
                            <img
                              src={image}
                              alt={v.product?.name}
                              className="h-full w-full object-cover transition group-hover:scale-105"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center">
                              <PackageIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="p-3">
                        <div className="truncate text-sm font-semibold">{v.product?.name}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {v.variant_name}
                          {v.size ? ` - ${v.size}` : ""}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-base font-bold">{formatCurrency(v.price)}</span>
                          <span className="text-xs text-muted-foreground">In stock</span>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="flex flex-col border-t border-border bg-card lg:border-l lg:border-t-0">
        <div className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-bold">Current sale</h2>
          <p className="text-xs text-muted-foreground">
            {cart.length} line{cart.length === 1 ? "" : "s"} · {cart.reduce((s, l) => s + l.qty, 0)}{" "}
            item{cart.reduce((s, l) => s + l.qty, 0) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Tap a product to start.</p>
            </div>
          ) : (
            <div className="relative rounded-xl border border-dashed border-border bg-[hsl(var(--card))] p-4 font-mono text-[13px] shadow-[var(--shadow-elev-1)]">
              <button
                type="button"
                aria-label="Cancel sale"
                title="Cancel this sale"
                onClick={cancelSale}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="text-center">
                <div className="text-sm font-bold tracking-[0.18em] uppercase">Receipt</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date().toLocaleString()}
                </div>
              </div>

              <div className="my-3 border-t border-dashed border-border" />
              <ul className="space-y-3">
                {cart.map((l) => (
                  <li key={l.variant.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold">
                        {l.variant.product?.name}
                      </span>
                      <span className="tabular-nums font-semibold">
                        {formatCurrency(Number(l.variant.price) * l.qty)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="min-w-0 truncate">
                        {l.variant.variant_name}
                        {l.variant.size ? ` - ${l.variant.size}` : ""} · {l.qty} ×{" "}
                        {formatCurrency(l.variant.price)}
                      </span>
                      <span className="flex items-center gap-1">
                        <button
                          aria-label="Decrease"
                          onClick={() => changeQty(l.variant.id, -1)}
                          className="grid h-6 w-6 place-items-center rounded border border-border hover:bg-accent"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <button
                          aria-label="Increase"
                          onClick={() => changeQty(l.variant.id, 1)}
                          className="grid h-6 w-6 place-items-center rounded border border-border hover:bg-accent"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          aria-label="Remove"
                          onClick={() => removeLine(l.variant.id)}
                          className="grid h-6 w-6 place-items-center rounded border border-border hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="my-3 border-t border-dashed border-border" />
              <div className="flex items-baseline justify-between text-sm font-bold">
                <span>TOTAL</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Payment</label>
            <Select value={payment} onValueChange={(v) => setPayment(v as typeof payment)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mobile">EcoCash / Mobile</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Amount paid (optional)
            </label>
            <Input
              inputMode="decimal"
              placeholder={formatCurrency(subtotal)}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
            {Number(amountPaid) > subtotal && (
              <p className="text-xs font-medium text-emerald-700">
                Change: {formatCurrency(Number(amountPaid) - subtotal)}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={cart.length === 0 || checkingOut}
            onClick={() => checkout.mutate()}
          >
            {checkingOut ? "Saving on device..." : online ? "Complete sale" : "Save sale offline"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Sales are saved on this device first, then uploaded automatically.
          </p>
        </div>
      </aside>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Cashier User Manual</DialogTitle>
          </DialogHeader>
          <CashierManualContent />
        </DialogContent>
      </Dialog>
      <Dialog
        open={receipt !== null}
        onOpenChange={(o) => {
          if (!o) setReceipt(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sale completed</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div className="space-y-3">
              <div className="rounded-lg border border-dashed border-border bg-accent/30 p-3 text-xs">
                <pre className="whitespace-pre-wrap font-mono leading-relaxed">
                  {receiptText(receipt.entry, {
                    amountPaid: receipt.amountPaid,
                    change: receipt.change,
                  })}
                </pre>
              </div>
              <p className="text-xs text-muted-foreground">
                Receipt {receiptNumber(receipt.entry)} is stored on this device. Reprint it any time
                from the transaction log.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="flex-1"
                  onClick={() =>
                    printReceipt(receipt.entry, {
                      amountPaid: receipt.amountPaid,
                      change: receipt.change,
                    })
                  }
                >
                  Print receipt
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    downloadReceipt(receipt.entry, {
                      amountPaid: receipt.amountPaid,
                      change: receipt.change,
                    })
                  }
                >
                  Download
                </Button>
                <Button variant="ghost" onClick={() => setReceipt(null)}>
                  Next sale
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function VoiceCommandHelp() {
  const commands = [
    ["add Coke", "Adds the best matching product to the cart."],
    ["add 3 Coke", "Adds a quantity in one command."],
    ["remove Coke", "Removes a matching item from the cart."],
    ["search sugar", "Filters the product grid."],
    ["new", "Clears the current cart for a new sale."],
    ["cash", "Sets payment to Cash."],
    ["ecocash", "Sets payment to EcoCash / Mobile."],
    ["checkout", "Completes or queues the sale, depending on connection."],
  ];
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Tap Voice, speak one command clearly, then wait for the action to complete.
      </p>
      <div className="grid gap-2">
        {commands.map(([command, description]) => (
          <div
            key={command}
            className="grid gap-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3 sm:grid-cols-[140px_1fr]"
          >
            <code className="font-semibold text-blue-800">{command}</code>
            <span className="text-muted-foreground">{description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CashierManualContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <section>
        <h3 className="font-semibold text-base">1. Opening cashier mode</h3>
        <p className="text-muted-foreground">
          From the welcome or auth page, tap Enter Cashier Mode. The till opens without a password
          for fast counter access. Named cashier accounts can still sign in when the manager wants
          staff-specific tracking.
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-base">2. Finding a product</h3>
        <p className="text-muted-foreground">
          Use the search bar at the top of the product grid. You can search by product name,
          variant, or category.
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-base">3. Adding items to the cart</h3>
        <p className="text-muted-foreground">
          Tap any product card. It appears in the current sale panel. Use plus and minus to change
          quantity. Tap the trash icon to remove a line.
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-base">4. Taking payment</h3>
        <p className="text-muted-foreground">
          Choose the payment method, confirm the total with the customer, and tap Complete sale.
          Stock updates automatically.
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-base">5. Voice commands</h3>
        <p className="text-muted-foreground">
          Tap Voice and say commands such as add Coke, add 3 Coke, remove Coke, search sugar, new,
          cash, ecocash, or checkout. Use Voice help in the cashier top bar for the full list.
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-base">6. Working offline and syncing</h3>
        <p className="text-muted-foreground">
          If the connection drops, keep serving customers. Sales are stored securely on this device,
          a pending badge shows what is waiting, and sync runs automatically when the device comes
          back online. You can also press Sync while online.
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-base">7. Stock warnings</h3>
        <p className="text-muted-foreground">
          Out means the item cannot be sold. Low means only a few units remain - let the manager
          know.
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-base">8. Installing on a device</h3>
        <p className="text-muted-foreground">
          Tap Install in Chrome or Edge on the published site. The app appears with the other apps
          on the device and keeps the cashier dashboard available after it has loaded once.
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-base">9. Signing out</h3>
        <p className="text-muted-foreground">
          Tap Sign out at the end of your shift when using a named account. Shared cashier mode can
          be opened again from the auth page.
        </p>
      </section>
    </div>
  );
}

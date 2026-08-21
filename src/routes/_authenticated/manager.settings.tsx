import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Settings, Save, RotateCcw, Download, Eye, EyeOff, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useShowInstallButton } from "@/hooks/use-app-prefs";
import { runTransactionReset } from "@/lib/transaction-reset";
import { computeSalesToday, setSalesTodayMarker } from "@/lib/sales-today";
import { readLog } from "@/lib/transaction-log";
import { recordResetLog } from "@/lib/reset-logs";

export const Route = createFileRoute("/_authenticated/manager/settings")({
  component: ManagerSettingsPage,
});

const SETTINGS_KEY = "tillpoint.manager.settings.v1";

type SettingsForm = {
  shopName: string;
  currency: string;
  taxRate: string;
  lowStockDefault: string;
  managerName: string;
  managerTitle: string;
  cashierName: string;
  cashierTitle: string;
};

const defaults: SettingsForm = {
  shopName: "Green Shop",
  currency: "USD",
  taxRate: "0",
  lowStockDefault: "10",
  managerName: "Mr Pride Tatire",
  managerTitle: "Manager",
  cashierName: "Cashier",
  cashierTitle: "Cashier",
};

function readSettings(): SettingsForm {
  try {
    return {
      ...defaults,
      ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<SettingsForm>),
    };
  } catch {
    return defaults;
  }
}

function ManagerSettingsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(defaults);
  const [saving, setSaving] = useState(false);
  const [showInstall, setShowInstall] = useShowInstallButton();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmSalesReset, setConfirmSalesReset] = useState(false);
  const [salesToday, setSalesToday] = useState({ total: 0, count: 0 });
  const [resetting, setResetting] = useState(false);
  const [storage, setStorage] = useState({ usage: 0, quota: 0 });

  useEffect(() => {
    setSalesToday(computeSalesToday(readLog()));
  }, [confirmSalesReset]);

  async function resetSalesToday() {
    const snapshot = computeSalesToday(readLog());
    setSalesTodayMarker();
    await recordResetLog({
      kind: "sales_today_reset",
      label: "Sales today reset",
      details: `Cleared the till "Sales today" counter (${snapshot.count} sale${snapshot.count === 1 ? "" : "s"}). Sales history was kept.`,
      amount: snapshot.total,
      count: snapshot.count,
      actor: profile?.full_name ?? "Manager",
    });
    setSalesToday({ total: 0, count: 0 });
    setConfirmSalesReset(false);
    toast.success("Sales today counter reset to zero.");
  }

  async function resetTransactions() {
    setResetting(true);
    const snapshot = computeSalesToday(readLog());
    const cleared = readLog();
    try {
      await runTransactionReset(null);
      setSalesTodayMarker();
      await recordResetLog({
        kind: "transaction_reset",
        label: "Transaction reset",
        details:
          "Cleared all sales, sale items and the transaction log; every variant returned to its registered peak quantity.",
        amount: cleared.reduce((sum, e) => sum + Number(e.total), 0) || snapshot.total,
        count: cleared.length,
        actor: profile?.full_name ?? "Manager",
      });
      ["sales", "sales-by-day", "stock", "products", "cashier", "manager", "daily-cash"].forEach(
        (key) => qc.invalidateQueries({ queryKey: [key] }),
      );
      toast.success("Transactions cleared and every product returned to its registered peak quantity.");
      setConfirmReset(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transaction reset failed.");
    } finally {
      setResetting(false);
    }
  }
  useEffect(() => {
    void navigator.storage
      ?.estimate()
      .then(({ usage = 0, quota = 0 }) => setStorage({ usage, quota }));
  }, []);

  useEffect(() => setForm(readSettings()), []);

  function update<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const taxRate = Number(form.taxRate);
    const lowStockDefault = Number(form.lowStockDefault);
    if (!form.shopName.trim() || !form.currency.trim() || taxRate < 0 || lowStockDefault < 0) {
      toast.error("Check the settings values and try again.");
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(form));
      window.dispatchEvent(
        new StorageEvent("storage", { key: SETTINGS_KEY, newValue: JSON.stringify(form) }),
      );
      if (profile?.id) {
        await supabase
          .from("profiles")
          .update({ full_name: profile.full_name })
          .eq("id", profile.id);
      }
      toast.success("Manager settings saved on this device.");
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manager settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the local checkout defaults for this shop.
          </p>
        </div>
      </header>

      <Card className="mb-6 max-w-2xl border-destructive/30 p-6">
        <div className="flex items-center gap-2 font-semibold text-destructive">
          <RotateCcw className="h-4 w-4" /> Transaction Reset
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Clears the Sales and Transaction Log pages back to zero and returns every product variant
          to its own highest registered peak quantity. Products, suppliers, expenses and
          cash records are never deleted. Export your sales first if you need a copy.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/manager/sales">
              <Download className="mr-2 h-4 w-4" /> Export sales first
            </a>
          </Button>
          <Button variant="destructive" onClick={() => setConfirmReset(true)} disabled={resetting}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {resetting ? "Resetting..." : "Transaction Reset"}
          </Button>
        </div>
      </Card>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every recorded transaction and resets all product quantities
              to their registered peak. Products are kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetting}
              onClick={(e) => {
                e.preventDefault();
                void resetTransactions();
              }}
            >
              {resetting ? "Resetting..." : "Yes, reset transactions"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mb-6 max-w-2xl border-primary/30 p-6">
        <div className="flex items-center gap-2 font-semibold">
          <Timer className="h-4 w-4 text-primary" /> Sales today reset
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Sets the cashier&apos;s &quot;Sales today&quot; total back to zero for a fresh shift. Sales
          records, stock and reports are untouched - only the till counter restarts.
        </p>
        <div className="mt-3 text-sm">
          Current counter:{" "}
          <span className="font-semibold tabular-nums">
            {salesToday.total.toFixed(2)} ({salesToday.count} sale
            {salesToday.count === 1 ? "" : "s"})
          </span>
        </div>
        <div className="mt-4">
          <Button variant="outline" onClick={() => setConfirmSalesReset(true)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Sales today Reset
          </Button>
        </div>
      </Card>

      <AlertDialog open={confirmSalesReset} onOpenChange={setConfirmSalesReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This resets the &quot;Sales today&quot; amount shown on the cashier dashboard back to
              zero. Sales history is kept and the reset is recorded on the Reset Logs page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void resetSalesToday();
              }}
            >
              Yes, reset Sales today
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mb-6 max-w-2xl p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              {showInstall ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              Show the &quot;Install app&quot; button on the home page
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Turn off once every device has installed TillPoint to keep the welcome page clean.
            </p>
          </div>
          <Switch
            checked={showInstall}
            onCheckedChange={(v) => {
              setShowInstall(v);
              toast.success(v ? "Install button is visible" : "Install button is hidden");
            }}
          />
        </div>
      </Card>

      <Card className="mb-6 max-w-2xl p-6">
        <h2 className="font-semibold">Online database storage monitor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This device&apos;s cached application storage used for offline checkout.
        </p>
        <Progress
          className="mt-4"
          value={storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0}
        />
        <div className="mt-2 text-xs text-muted-foreground">
          {storage.quota
            ? `${(storage.usage / 1048576).toFixed(1)} MB used of ${(storage.quota / 1048576).toFixed(1)} MB available`
            : "Storage estimate unavailable"}
        </div>
      </Card>
      <Card className="max-w-2xl p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shopName">Shop name</Label>
            <Input
              id="shopName"
              value={form.shopName}
              onChange={(e) => update("shopName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={form.currency}
              onChange={(e) => update("currency", e.target.value.toUpperCase())}
              maxLength={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxRate">Tax rate (%)</Label>
            <Input id="taxRate" value="0" readOnly disabled />
            <p className="text-xs text-muted-foreground">
              This shop operates tax free - prices and receipts are the final amount.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lowStockDefault">Default low-stock threshold</Label>
            <Input
              id="lowStockDefault"
              type="number"
              min="0"
              value={form.lowStockDefault}
              onChange={(e) => update("lowStockDefault", e.target.value)}
            />
          </div>
          <div className="border-t border-border pt-4 sm:col-span-2">
            <h2 className="font-semibold">Role identities</h2>
            <p className="text-sm text-muted-foreground">
              These names and titles appear across the manager and cashier workspaces.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="managerName">Manager name</Label>
            <Input
              id="managerName"
              value={form.managerName}
              onChange={(e) => update("managerName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="managerTitle">Manager title</Label>
            <Input
              id="managerTitle"
              value={form.managerTitle}
              onChange={(e) => update("managerTitle", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cashierName">Cashier name</Label>
            <Input
              id="cashierName"
              value={form.cashierName}
              onChange={(e) => update("cashierName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cashierTitle">Cashier title</Label>
            <Input
              id="cashierTitle"
              value={form.cashierTitle}
              onChange={(e) => update("cashierTitle", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

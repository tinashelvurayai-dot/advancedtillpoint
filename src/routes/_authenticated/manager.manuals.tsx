import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { CashierManualContent } from "./cashier";

export const Route = createFileRoute("/_authenticated/manager/manuals")({
  component: ManualsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold text-base">{title}</h3>
      <div className="text-muted-foreground space-y-2">{children}</div>
    </section>
  );
}

function ManagerManualContent() {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <Section title="1. How the system fits together">
        <p>
          TillPoint has one catalogue and one sales ledger shared by every screen. Products create
          variants, variants create stock rows, cashier sales consume stock and write transactions,
          and every report page (Dashboard, Sales, Daily Cash, Expenses &amp; Profit, Forecast,
          Alerts) simply reads that same data from a different angle. Change something in Products
          or Stock and every other page updates immediately.
        </p>
        <p>
          Flow: <span className="font-medium">Suppliers → Stock-In Records → Stock → Cashier till →
          Sales → Daily Cash + Expenses → Profit &amp; Forecast</span>, with Orders and Low Stock
          Alerts feeding back into Stock-In.
        </p>
      </Section>

      <Section title="2. Dashboard (/manager)">
        <p>
          Today&apos;s revenue, transaction count, active products and low-stock alerts, plus a live
          feed of recent sales with the cashier name. Revenue comes from the Sales ledger, the alert
          count comes from Stock (any variant at or below its alert level, now set to 10).
        </p>
      </Section>

      <Section title="3. Products">
        <p>
          Create a product with name, category and photo (camera or upload), then add its variants -
          size, flavour or colour - each with its own selling price, SKU and opening stock. Deleting
          or deactivating a variant removes it from the cashier grid but keeps historical sales
          intact. Prices set here are the prices the till charges.
        </p>
      </Section>

      <Section title="4. Stock">
        <p>
          Every variant is in stock by default and cashiers can sell without a quantity check. When
          a shelf runs out the cashier presses <span className="font-medium">Out of Stock</span> on
          the tile; it is flagged instantly and blocked from sale. Managers clear a single flag with{" "}
          <span className="font-medium">Stock Available</span>, or clear everything with{" "}
          <span className="font-medium">Stock Available (All)</span> after a restock. Use the{" "}
          <span className="font-medium">+</span> button to add the units that were brought in - you
          never recount the whole shop. The low-stock alert level is 10 units for every variant.
        </p>
      </Section>

      <Section title="5. Stock-In Records">
        <p>
          The delivery register. Pick the product/variant using the smart search bar (type any part
          of a product name, variant or category), choose the supplier, enter units received, the
          unit buying price and the date. Saving adds the units to Stock automatically and stores
          the buying cost, which is what makes profit reporting accurate. Records can be edited and
          the stock level corrects itself. Filter by supplier, text or date range and export.
        </p>
      </Section>

      <Section title="6. Suppliers">
        <p>
          Supplier contacts and purchase records. Suppliers chosen here appear in the Stock-In
          Records supplier list and in supplier cost totals.
        </p>
      </Section>

      <Section title="7. Orders">
        <p>
          Dated restock requests raised by cashiers when they flag an item out of stock. Work
          through the list, buy the goods, then close the loop by recording the delivery in
          Stock-In Records - that is what returns the item to sale.
        </p>
      </Section>

      <Section title="8. Low Stock Alerts">
        <p>
          Every variant at or below 10 units, ranked by urgency. This page is the shortlist for your
          next purchase order.
        </p>
      </Section>

      <Section title="9. Sales">
        <p>
          The full transaction ledger: date, cashier name, payment method, item count and total.
          Search, filter by date and use <span className="font-medium">Export CSV</span> for
          accounting or backup. This ledger feeds the Dashboard, Daily Cash expectation and Profit
          figures.
        </p>
      </Section>

      <Section title="10. Daily Cash Collection">
        <p>
          Record the cash physically collected each day. The page balances it for you:{" "}
          <span className="font-medium">cash sales for the day minus expenses paid out that day =
          the amount expected in the drawer</span>. The variance card shows any shortfall or
          overage, so a day where money was spent on expenses still balances correctly.
        </p>
      </Section>

      <Section title="11. Expenses &amp; Profit">
        <p>
          Log every business expense with a category and date. Expenses are subtracted from sales
          revenue for the profit view and from the day&apos;s expected cash on the Daily Cash page,
          so both screens always agree.
        </p>
      </Section>

      <Section title="12. Forecast">
        <p>
          Projects demand from recent sales history so you can order ahead. Accuracy depends on
          having real sales recorded - a fresh Transaction Reset restarts the history.
        </p>
      </Section>

      <Section title="13. Staff / Cashiers">
        <p>
          Everyone with access, with editable names, IDs and active status. Cashier mode opens
          without a password from the welcome page for shared counter devices; manager access is
          behind the hidden logo taps and two access codes.
        </p>
      </Section>

      <Section title="14. Transaction Log, Sync Queue and Shift Report">
        <p>
          The Transaction Log is the device&apos;s own copy of every sale, including offline ones,
          with receipt reprint and CSV export. The Sync Queue shows offline sales still waiting to
          upload and lets you retry. The Shift Report totals a cashier&apos;s shift for handover.
          Leaving these pages keeps you signed in as manager.
        </p>
      </Section>

      <Section title="15. Settings">
        <p>
          Shop name, currency, tax rate, default low-stock threshold and role identities, plus the
          storage monitor for this device.
        </p>
        <p>
          <span className="font-medium">Transaction Reset</span> clears the Sales and Transaction
          Log pages back to zero and returns every product quantity to its highest registered peak
          of 40 units. Products, suppliers, expenses and cash records are kept. It asks &quot;Are
          you sure?&quot; before anything is deleted - export your sales first.
        </p>
        <p>
          <span className="font-medium">Install app button</span> - a switch that shows or hides the
          &quot;Install app&quot; button on the home page once all devices are set up.
        </p>
      </Section>

      <Section title="16. Manuals">
        <p>
          This page. The switch above shows or hides the Manual button inside the cashier dashboard.
        </p>
      </Section>

      <Section title="17. Offline behaviour and installation">
        <p>
          Install from Chrome so the app sits alongside other device apps. Once the cashier
          dashboard has loaded online at least once, cashiers can sell fully offline - sales queue
          on the device and sync automatically when the connection returns, then appear in Sales and
          on the Dashboard.
        </p>
      </Section>

      <Section title="18. Handover agreement">
        <p>
          The Agreement page holds the signed POS Software Development, Handover &amp; Acceptance
          Agreement and can be downloaded as a document at any time.
        </p>
      </Section>
    </div>
  );
}

function ManualsPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["manager", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("show_cashier_manual")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data ?? { show_cashier_manual: true };
    },
  });

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("id", true)
        .maybeSingle();
      if (!existing) {
        const { error } = await supabase
          .from("app_settings")
          .insert({ id: true, show_cashier_manual: next });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .update({ show_cashier_manual: next, updated_at: new Date().toISOString() })
          .eq("id", true);
        if (error) throw error;
      }
    },
    onSuccess: (_d, next) => {
      toast.success(next ? "Cashier manual is now visible" : "Cashier manual is now hidden");
      qc.invalidateQueries({ queryKey: ["manager", "settings"] });
      qc.invalidateQueries({ queryKey: ["cashier", "settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enabled = settings.data?.show_cashier_manual !== false;

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">User manuals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reference guides for every role, and controls for what your cashiers see.
        </p>
      </header>

      <Card className="mb-8 p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              {enabled ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              Show cashier manual inside the cashier dashboard
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              When on, cashiers see a Manual button in the top bar of their dashboard that opens a
              step-by-step guide. Turn off to keep the cashier screen focused on selling only.
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={toggle.isPending || settings.isLoading}
            onCheckedChange={(v) => toggle.mutate(v)}
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Read the manuals</h2>
        </div>
        <Tabs defaultValue="manager">
          <TabsList>
            <TabsTrigger value="manager">Manager manual</TabsTrigger>
            <TabsTrigger value="cashier">Cashier manual</TabsTrigger>
          </TabsList>
          <TabsContent value="manager" className="mt-6">
            <ManagerManualContent />
          </TabsContent>
          <TabsContent value="cashier" className="mt-6">
            <CashierManualContent />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertTriangle,
  Boxes,
  Check,
  ChevronsUpDown,
  ClipboardList,
  DollarSign,
  Pencil,
  Plus,
  Search,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { useOnline } from "@/hooks/use-online";

export const Route = createFileRoute("/_authenticated/manager/stock-in")({
  component: StockInRecordsPage,
});

type Variant = {
  id: string;
  variant_name: string;
  product: { name: string; category: string | null } | null;
  stock: { id: string; quantity: number }[] | null;
};
type RecordRow = {
  id: string;
  variant_id: string;
  stock_id: string;
  supplier_id: string | null;
  quantity: number;
  unit_buying_price: number;
  total_cost: number;
  received_at: string;
  notes: string | null;
  variant: Variant | null;
  supplier: { name: string } | null;
};
type StockRow = {
  id: string;
  quantity: number;
  low_stock_alert_level: number;
  available?: boolean;
  variant: {
    id: string;
    variant_name: string;
    size: string | null;
    price: number;
    product: { name: string; category: string | null } | null;
  } | null;
};

const blank = {
  variantId: "",
  supplierId: "none",
  quantity: "",
  price: "",
  receivedAt: new Date().toISOString().slice(0, 16),
  notes: "",
};

function StockInRecordsPage() {
  const qc = useQueryClient();
  const online = useOnline();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [search, setSearch] = useState("");
  const [variantOpen, setVariantOpen] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Stock control state
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "low" | "out" | "ok">("all");
  const [addStockFor, setAddStockFor] = useState<StockRow | null>(null);
  const [editPriceFor, setEditPriceFor] = useState<StockRow | null>(null);

  const invalidateAll = () => {
    ["stock-in-records", "stock", "stock-in-variants", "products", "cashier", "restock-orders"].forEach(
      (key) => qc.invalidateQueries({ queryKey: [key] }),
    );
  };

  useEffect(() => {
    const channel = supabase
      .channel("stock-in-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_in_records" }, () => {
        invalidateAll();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  const variants = useQuery({
    queryKey: ["stock-in-variants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, variant_name, product:products(name, category), stock(id, quantity)")
        .eq("active", true)
        .order("variant_name");
      if (error) throw error;
      return data as unknown as Variant[];
    },
  });
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const records = useQuery({
    queryKey: ["stock-in-records"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stock_in_records")
        .select(
          "id, variant_id, stock_id, supplier_id, quantity, unit_buying_price, total_cost, received_at, notes, variant:product_variants(variant_name, product:products(name, category)), supplier:suppliers(name)",
        )
        .order("received_at", { ascending: false });
      if (error) throw error;
      return data as unknown as RecordRow[];
    },
  });
  const stock = useQuery({
    queryKey: ["stock", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock")
        .select(
          "id, quantity, low_stock_alert_level, available, variant:product_variants(id, variant_name, size, price, product:products(name, category))",
        )
        .order("quantity");
      if (error) throw error;
      return data as unknown as StockRow[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!online) throw new Error("Reconnect before saving stock changes. Cached stock remains available offline.");
      const variant = variants.data?.find((v) => v.id === form.variantId);
      const stockId = editing?.stock_id ?? variant?.stock?.[0]?.id;
      if (!form.variantId) throw new Error("Choose a product variant");
      if (!stockId) throw new Error("This variant has no stock record yet");
      const quantity = Number(form.quantity);
      const price = Number(form.price);
      if (!Number.isInteger(quantity) || quantity <= 0 || !(price >= 0))
        throw new Error("Enter a valid quantity and buying price");
      if (editing) {
        const { error } = await (supabase as any).rpc("update_stock_in_record", {
          p_id: editing.id,
          p_quantity: quantity,
          p_unit_buying_price: price,
          p_supplier_id: form.supplierId === "none" ? null : form.supplierId,
          p_received_at: new Date(form.receivedAt).toISOString(),
          p_notes: form.notes || null,
        });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).rpc("record_stock_in", {
          p_stock_id: stockId,
          p_variant_id: form.variantId,
          p_quantity: quantity,
          p_unit_buying_price: price,
          p_supplier_id: form.supplierId === "none" ? null : form.supplierId,
          p_received_at: new Date(form.receivedAt).toISOString(),
          p_notes: form.notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Stock-in record updated" : "Stock-in recorded");
      setForm({ ...blank, receivedAt: new Date().toISOString().slice(0, 16) });
      setEditing(null);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickAdd = useMutation({
    mutationFn: async ({
      row,
      add,
      unitPrice,
      supplierId,
    }: {
      row: StockRow;
      add: number;
      unitPrice: number;
      supplierId: string;
    }) => {
      if (!online) throw new Error("Reconnect before adding stock. Cached stock remains available offline.");
      if (!row.variant) throw new Error("Missing variant");
      const { error } = await (supabase as any).rpc("record_stock_in", {
        p_stock_id: row.id,
        p_variant_id: row.variant.id,
        p_quantity: add,
        p_unit_buying_price: unitPrice,
        p_supplier_id: supplierId === "none" ? null : supplierId,
        p_received_at: new Date().toISOString(),
        p_notes: "Quick stock-in from stock table",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock added and recorded");
      setAddStockFor(null);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStock = useMutation({
    mutationFn: async ({ id, quantity, low }: { id: string; quantity: number; low: number }) => {
      const { error } = await supabase
        .from("stock")
        .update({ quantity, low_stock_alert_level: low })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock updated");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePrice = useMutation({
    mutationFn: async ({ variant_id, price }: { variant_id: string; price: number }) => {
      const { error } = await supabase
        .from("product_variants")
        .update({ price })
        .eq("id", variant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Selling price updated");
      setEditPriceFor(null);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAvailable = useMutation({
    mutationFn: async (variant_id: string) => {
      const { error } = await supabase.rpc(
        "mark_variant_available" as any,
        { _variant_id: variant_id } as any,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as available");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedVariant = (variants.data ?? []).find((v) => v.id === form.variantId);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (records.data ?? []).filter((r) => {
      const text =
        `${r.variant?.product?.name ?? ""} ${r.variant?.variant_name ?? ""} ${r.variant?.product?.category ?? ""} ${r.supplier?.name ?? ""}`.toLowerCase();
      const date = r.received_at.slice(0, 10);
      return (
        (!q || text.includes(q)) &&
        (supplierFilter === "all" || r.supplier_id === supplierFilter) &&
        (!from || date >= from) &&
        (!to || date <= to)
      );
    });
  }, [records.data, search, supplierFilter, from, to]);
  const total = filtered.reduce((sum, r) => sum + Number(r.total_cost), 0);

  const rows = stock.data ?? [];
  const stats = useMemo(() => {
    const totalUnits = rows.reduce((s, r) => s + r.quantity, 0);
    const inventoryValue = rows.reduce((s, r) => s + r.quantity * Number(r.variant?.price ?? 0), 0);
    const out = rows.filter((r) => r.quantity === 0).length;
    const low = rows.filter((r) => r.quantity > 0 && r.quantity <= r.low_stock_alert_level).length;
    return { totalUnits, inventoryValue, out, low, skus: rows.length };
  }, [rows]);

  const stockFiltered = rows.filter((r) => {
    const q = filter.toLowerCase();
    const matchQ =
      !q ||
      r.variant?.variant_name.toLowerCase().includes(q) ||
      r.variant?.product?.name.toLowerCase().includes(q);
    const status = r.quantity === 0 ? "out" : r.quantity <= r.low_stock_alert_level ? "low" : "ok";
    const matchS = statusFilter === "all" || status === statusFilter;
    return matchQ && matchS;
  });
  const flaggedOutCount = rows.filter((r) => r.available === false).length;

  function editRecord(record: RecordRow) {
    setEditing(record);
    setForm({
      variantId: record.variant_id,
      supplierId: record.supplier_id ?? "none",
      quantity: String(record.quantity),
      price: String(record.unit_buying_price),
      receivedAt: record.received_at.slice(0, 16),
      notes: record.notes ?? "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetForm() {
    setEditing(null);
    setForm({ ...blank, receivedAt: new Date().toISOString().slice(0, 16) });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Stock-in Record</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deliveries, buying costs, suppliers and live stock control in one place.
            {flaggedOutCount > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="font-semibold text-destructive">
                  {flaggedOutCount} flagged out by cashiers
                </span>
              </>
            )}
          </p>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<Boxes className="h-5 w-5 text-blue-600" />}
          label="SKUs"
          value={stats.skus.toString()}
          tone="blue"
        />
        <StatCard
          icon={<Boxes className="h-5 w-5 text-slate-600" />}
          label="Units on hand"
          value={stats.totalUnits.toLocaleString()}
          tone="slate"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          label="Inventory value"
          value={formatCurrency(stats.inventoryValue)}
          tone="emerald"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          label="Low / Out"
          value={`${stats.low} / ${stats.out}`}
          tone="amber"
        />
      </div>

      {(stats.low > 0 || stats.out > 0) && (
        <Card className="mb-6 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <TrendingDown className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="text-sm text-amber-900">
              <div className="font-semibold">Smart alert</div>
              <div>
                {stats.out > 0 && (
                  <>
                    {stats.out} item{stats.out === 1 ? "" : "s"} out of stock.{" "}
                  </>
                )}
                {stats.low > 0 && <>{stats.low} running low. </>}
                Record a delivery below to top them up.
              </div>
            </div>
          </div>
        </Card>
      )}

      {!online && (
        <Card className="mb-6 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          You are viewing the last synchronized stock-in data. Remote stock changes are disabled until the connection returns, so this page never reports an offline write as saved.
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Plus className="h-4 w-4" />
            {editing ? "Edit stock-in record" : "Record delivery"}
          </h2>
          <div className="space-y-4">
            <div>
              <Label>Product / variant</Label>
              <Popover open={variantOpen} onOpenChange={setVariantOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={variantOpen}
                    disabled={!!editing}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {selectedVariant
                        ? `${selectedVariant.product?.name} \u00b7 ${selectedVariant.variant_name}`
                        : "Search product or variant"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command
                    filter={(value, search) =>
                      value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }
                  >
                    <CommandInput placeholder="Type a product, variant or category..." />
                    <CommandList className="max-h-72 overflow-y-auto overscroll-contain">
                      <CommandEmpty>No matching product.</CommandEmpty>
                      <CommandGroup>
                        {(variants.data ?? []).map((v) => (
                          <CommandItem
                            key={v.id}
                            value={`${v.product?.name ?? ""} ${v.variant_name} ${v.product?.category ?? ""}`}
                            onSelect={() => {
                              setForm({ ...form, variantId: v.id });
                              setVariantOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                form.variantId === v.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">
                              {v.product?.name} &middot; {v.variant_name}
                            </span>
                            <span className="ml-auto pl-2 text-xs text-muted-foreground">
                              {v.stock?.[0]?.quantity ?? 0} in stock
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Supplier</Label>
              <Select
                value={form.supplierId}
                onValueChange={(value) => setForm({ ...form, supplierId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {(suppliers.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>Unit buying price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Date and time received</Label>
              <Input
                type="datetime-local"
                value={form.receivedAt}
                onChange={(e) => setForm({ ...form, receivedAt: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Invoice, batch, delivery notes..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending || !online}>
                {save.isPending ? "Saving..." : editing ? "Save changes" : "Record stock-in"}
              </Button>
              {editing && (
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Delivery register</h2>
              <p className="text-sm text-muted-foreground">
                {filtered.length} records · {formatCurrency(total)} total buying cost
              </p>
            </div>
            <Badge variant="outline">Live</Badge>
          </div>
          <div className="mb-5 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search products, categories, suppliers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="md:w-44">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {(suppliers.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From date"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
            />
          </div>
          <div className="max-h-[560px] divide-y divide-border overflow-y-auto overscroll-contain pr-1">
            {filtered.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <div className="font-medium">
                    {r.variant?.product?.name ?? "Product"} · {r.variant?.variant_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(r.received_at)} · {r.supplier?.name ?? "No supplier"}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="font-semibold">+{r.quantity} units</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(r.unit_buying_price)} each · {formatCurrency(r.total_cost)}{" "}
                      total
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => editRecord(r)}
                    aria-label="Edit stock-in record"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {!filtered.length && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No records match the current filters.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="font-semibold">Stock control</h2>
          <p className="text-sm text-muted-foreground">
            Live quantities, low-stock levels, selling prices and availability.
          </p>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            placeholder="Search product or variant..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-1">
            {(["all", "ok", "low", "out"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : s === "ok" ? "In stock" : s === "low" ? "Low" : "Out"}
              </Button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Low alert</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockFiltered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {stock.isLoading ? "Loading stock..." : "No stock matches."}
                  </TableCell>
                </TableRow>
              ) : (
                stockFiltered.map((r) => (
                  <StockEditor
                    key={r.id}
                    row={r}
                    onSave={(q, l) => updateStock.mutate({ id: r.id, quantity: q, low: l })}
                    onAdd={() => setAddStockFor(r)}
                    onEditPrice={() => setEditPriceFor(r)}
                    onMarkAvailable={() => r.variant && markAvailable.mutate(r.variant.id)}
                    pending={updateStock.isPending}
                    markPending={markAvailable.isPending}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!addStockFor} onOpenChange={(o) => !o && setAddStockFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add stock - {addStockFor?.variant?.product?.name}</DialogTitle>
          </DialogHeader>
          {addStockFor && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const add = parseInt(String(fd.get("add") ?? "0"), 10) || 0;
                const unitPrice = parseFloat(String(fd.get("unitPrice") ?? "0")) || 0;
                const supplierId = String(fd.get("supplierId") ?? "none");
                if (add > 0) quickAdd.mutate({ row: addStockFor, add, unitPrice, supplierId });
              }}
              className="space-y-4"
            >
              <div className="text-sm text-muted-foreground">
                Current: <span className="font-medium text-foreground">{addStockFor.quantity}</span>{" "}
                units
              </div>
              <div className="space-y-2">
                <Label>Units brought in</Label>
                <Input name="add" type="number" min="1" required autoFocus placeholder="e.g. 10" />
              </div>
              <div className="space-y-2">
                <Label>Unit buying price</Label>
                <Input
                  name="unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="e.g. 4.50"
                />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <select
                  name="supplierId"
                  defaultValue="none"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="none">No supplier</option>
                  {(suppliers.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={quickAdd.isPending || !online}>
                  {quickAdd.isPending ? "Adding..." : "Add to stock"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPriceFor} onOpenChange={(o) => !o && setEditPriceFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit price - {editPriceFor?.variant?.variant_name}</DialogTitle>
          </DialogHeader>
          {editPriceFor?.variant && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const price = parseFloat(String(fd.get("price") ?? "0"));
                if (price >= 0) updatePrice.mutate({ variant_id: editPriceFor.variant!.id, price });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>New selling price</Label>
                <Input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={Number(editPriceFor.variant.price)}
                  required
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updatePrice.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "blue" | "slate" | "emerald" | "amber";
}) {
  const bg = {
    blue: "bg-blue-50 border-blue-200",
    slate: "bg-slate-50 border-slate-200",
    emerald: "bg-emerald-50 border-emerald-200",
    amber: "bg-amber-50 border-amber-200",
  }[tone];
  return (
    <Card className={`border p-4 ${bg}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{value}</div>
    </Card>
  );
}

function StockEditor({
  row,
  onSave,
  onAdd,
  onEditPrice,
  onMarkAvailable,
  pending,
  markPending,
}: {
  row: StockRow;
  onSave: (q: number, l: number) => void;
  onAdd: () => void;
  onEditPrice: () => void;
  onMarkAvailable: () => void;
  pending: boolean;
  markPending: boolean;
}) {
  const [q, setQ] = useState(row.quantity);
  const [l, setL] = useState(row.low_stock_alert_level);
  useEffect(() => {
    setQ(row.quantity);
    setL(row.low_stock_alert_level);
  }, [row.quantity, row.low_stock_alert_level]);
  const dirty = q !== row.quantity || l !== row.low_stock_alert_level;
  const flaggedOut = row.available === false;
  const status = flaggedOut ? "flagged" : q === 0 ? "out" : q <= l ? "low" : "ok";
  const value = q * Number(row.variant?.price ?? 0);
  return (
    <TableRow className={flaggedOut ? "bg-red-50/50" : undefined}>
      <TableCell className="font-medium">{row.variant?.product?.name}</TableCell>
      <TableCell>
        <div>{row.variant?.variant_name}</div>
        <div className="text-xs text-muted-foreground">{row.variant?.size}</div>
      </TableCell>
      <TableCell>
        <button
          onClick={onEditPrice}
          className="inline-flex items-center gap-1 rounded px-1 hover:bg-blue-50 hover:text-blue-700"
        >
          {formatCurrency(row.variant?.price ?? 0)}
        </button>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          value={q}
          onChange={(e) => setQ(Number(e.target.value) || 0)}
          className="w-20"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          value={l}
          onChange={(e) => setL(Number(e.target.value) || 0)}
          className="w-20"
        />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatCurrency(value)}</TableCell>
      <TableCell>
        {status === "flagged" ? (
          <Badge variant="destructive">Flagged out</Badge>
        ) : status === "out" ? (
          <Badge variant="destructive">Out</Badge>
        ) : status === "low" ? (
          <Badge className="bg-amber-500 text-white">Low</Badge>
        ) : (
          <Badge variant="secondary">OK</Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={onAdd} aria-label="Add stock">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" disabled={!dirty || pending} onClick={() => onSave(q, l)}>
            Save
          </Button>
          <Button
            size="sm"
            variant={flaggedOut ? "default" : "outline"}
            disabled={markPending}
            onClick={onMarkAvailable}
            className={flaggedOut ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            Stock Available
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

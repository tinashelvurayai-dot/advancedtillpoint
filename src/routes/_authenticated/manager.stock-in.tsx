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
import { Check, ChevronsUpDown, ClipboardList, Pencil, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

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
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [search, setSearch] = useState("");
  const [variantOpen, setVariantOpen] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const channel = supabase
      .channel("stock-in-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_in_records" }, () => {
        void qc.invalidateQueries({ queryKey: ["stock-in-records"] });
        void qc.invalidateQueries({ queryKey: ["stock"] });
        void qc.invalidateQueries({ queryKey: ["products"] });
        void qc.invalidateQueries({ queryKey: ["cashier"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
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

  const save = useMutation({
    mutationFn: async () => {
      const variant = variants.data?.find((v) => v.id === form.variantId);
      const stockId = editing?.stock_id ?? variant?.stock?.[0]?.id;
      if (!stockId || !form.variantId) throw new Error("Choose a product variant");
      const quantity = Number(form.quantity);
      const price = Number(form.price);
      if (!Number.isInteger(quantity) || quantity <= 0 || price < 0)
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
      setForm(blank);
      setEditing(null);
      ["stock-in-records", "stock", "products", "cashier", "restock-orders"].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
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
  }
  function resetForm() {
    setEditing(null);
    setForm(blank);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock-In Records</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A complete, searchable register of deliveries, buying costs, suppliers, and inventory
            movement.
          </p>
        </div>
      </header>
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
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
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
    </div>
  );
}

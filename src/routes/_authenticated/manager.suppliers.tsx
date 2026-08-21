import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, formatDate } from "@/lib/format";
import { Truck, Plus, Trash2, PackageCheck, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/manager/suppliers")({
  component: SuppliersPage,
});

type POItem = { name: string; quantity: number; unit_cost: number };

function SuppliersPage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [supForm, setSupForm] = useState({
    name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    products_offered: "",
  });
  const [poOpen, setPoOpen] = useState(false);
  const [poForm, setPoForm] = useState<{
    supplier_id: string;
    notes: string;
    auto_reorder: boolean;
    items: POItem[];
  }>({
    supplier_id: "",
    notes: "",
    auto_reorder: false,
    items: [{ name: "", quantity: 1, unit_cost: 0 }],
  });

  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const pos = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, supplier:suppliers(name)")
        .order("order_date", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addSupplier = useMutation({
    mutationFn: async () => {
      if (!supForm.name.trim()) throw new Error("Supplier name required");
      const { products_offered, ...supplier } = supForm;
      const notes = [
        supplier.notes,
        products_offered ? `Products and prices offered:\n${products_offered}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const { error } = await supabase.from("suppliers").insert({ ...supplier, notes });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier added");
      setSupplierOpen(false);
      setSupForm({
        name: "",
        contact_name: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
        products_offered: "",
      });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSupplier = useMutation({
    mutationFn: async () => {
      const { products_offered, ...supplier } = supForm;
      const notes = [
        supplier.notes,
        products_offered ? `Products and prices offered:\n${products_offered}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const { error } = await supabase
        .from("suppliers")
        .update({ ...supplier, notes })
        .eq("id", editingSupplier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier updated");
      setEditingSupplier(null);
      setSupplierOpen(false);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const poTotal = useMemo(
    () => poForm.items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_cost || 0), 0),
    [poForm.items],
  );

  const addPO = useMutation({
    mutationFn: async () => {
      if (!poForm.supplier_id) throw new Error("Choose a supplier");
      const validItems = poForm.items.filter((i) => i.name.trim() && Number(i.quantity) > 0);
      if (validItems.length === 0) throw new Error("Add at least one item");
      const { error } = await supabase.from("purchase_orders").insert({
        supplier_id: poForm.supplier_id,
        items: validItems,
        total: validItems.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0),
        auto_reorder: poForm.auto_reorder,
        notes: poForm.notes || null,
        created_by: session?.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase order created");
      setPoOpen(false);
      setPoForm({
        supplier_id: "",
        notes: "",
        auto_reorder: false,
        items: [{ name: "", quantity: 1, unit_cost: 0 }],
      });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers & Purchase Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage suppliers, issue POs, and auto-reorder items running low.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSupplierOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add supplier
          </Button>
          <Button onClick={() => setPoOpen(true)} disabled={!suppliers.data?.length}>
            <Plus className="mr-2 h-4 w-4" /> New PO
          </Button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="border-blue-100 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Truck className="h-4 w-4 text-blue-600" /> Suppliers
          </h2>
          <ul className="divide-y divide-blue-100">
            {(suppliers.data ?? []).map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{s.name}</div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingSupplier(s);
                      setSupForm({
                        name: s.name ?? "",
                        contact_name: s.contact_name ?? "",
                        phone: s.phone ?? "",
                        email: s.email ?? "",
                        address: s.address ?? "",
                        notes: s.notes ?? "",
                        products_offered: "",
                      });
                      setSupplierOpen(true);
                    }}
                    aria-label={`Edit ${s.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.contact_name} {s.phone && `· ${s.phone}`}
                </div>
                {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
              </li>
            ))}
            {suppliers.data?.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">No suppliers yet.</li>
            )}
          </ul>
        </Card>

        <Card className="border-blue-100 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <PackageCheck className="h-4 w-4 text-blue-600" /> Purchase orders
          </h2>
          <ul className="divide-y divide-blue-100">
            {(pos.data ?? []).map((p: any) => (
              <li key={p.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.supplier?.name ?? "Supplier"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(p.order_date)} · {(p.items as POItem[])?.length ?? 0} items
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(p.total)}</span>
                    <Select
                      value={p.status}
                      onValueChange={(v) => updateStatus.mutate({ id: p.id, status: v })}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="ordered">Ordered</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    {p.auto_reorder && (
                      <Badge variant="outline" className="border-blue-300 text-blue-700">
                        Auto
                      </Badge>
                    )}
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {(p.items as POItem[])?.slice(0, 4).map((it, i) => (
                    <li key={i}>
                      {it.quantity}x {it.name} @ {formatCurrency(it.unit_cost)}
                    </li>
                  ))}
                  {(p.items as POItem[])?.length > 4 && <li>+ {p.items.length - 4} more</li>}
                </ul>
              </li>
            ))}
            {pos.data?.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No purchase orders yet.
              </li>
            )}
          </ul>
        </Card>
      </section>

      {/* Add supplier dialog */}
      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit supplier" : "Add supplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={supForm.name}
                onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Contact person</Label>
              <Input
                value={supForm.contact_name}
                onChange={(e) => setSupForm({ ...supForm, contact_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input
                  value={supForm.phone}
                  onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={supForm.email}
                  onChange={(e) => setSupForm({ ...supForm, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={supForm.address}
                onChange={(e) => setSupForm({ ...supForm, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Products and prices offered</Label>
              <Textarea
                placeholder="e.g. Sugar — $2.70/kg\nRice — $5/5kg"
                value={supForm.products_offered}
                onChange={(e) => setSupForm({ ...supForm, products_offered: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={supForm.notes}
                onChange={(e) => setSupForm({ ...supForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => (editingSupplier ? updateSupplier.mutate() : addSupplier.mutate())}
              disabled={addSupplier.isPending || updateSupplier.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PO dialog */}
      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Supplier</Label>
              <Select
                value={poForm.supplier_id}
                onValueChange={(v) => setPoForm({ ...poForm, supplier_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose supplier" />
                </SelectTrigger>
                <SelectContent>
                  {(suppliers.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Items</Label>
              <div className="space-y-2">
                {poForm.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_100px_36px] items-center gap-2">
                    <Input
                      placeholder="Item name"
                      value={it.name}
                      onChange={(e) => {
                        const items = [...poForm.items];
                        items[i] = { ...it, name: e.target.value };
                        setPoForm({ ...poForm, items });
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={it.quantity}
                      onChange={(e) => {
                        const items = [...poForm.items];
                        items[i] = { ...it, quantity: Number(e.target.value) };
                        setPoForm({ ...poForm, items });
                      }}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Unit cost"
                      value={it.unit_cost}
                      onChange={(e) => {
                        const items = [...poForm.items];
                        items[i] = { ...it, unit_cost: Number(e.target.value) };
                        setPoForm({ ...poForm, items });
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setPoForm({ ...poForm, items: poForm.items.filter((_, x) => x !== i) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPoForm({
                      ...poForm,
                      items: [...poForm.items, { name: "", quantity: 1, unit_cost: 0 }],
                    })
                  }
                >
                  <Plus className="mr-1 h-3 w-3" /> Add row
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="auto"
                type="checkbox"
                checked={poForm.auto_reorder}
                onChange={(e) => setPoForm({ ...poForm, auto_reorder: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="auto">Mark as auto-reorder (recurring)</Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={poForm.notes}
                onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
              />
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-900">
              Total: {formatCurrency(poTotal)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addPO.mutate()} disabled={addPO.isPending}>
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Package as PackageIcon,
  Camera,
  Upload,
  Pencil,
  ImageOff,
  ImageIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { fileToCompressedDataUrl } from "@/lib/image-utils";
import { Switch } from "@/components/ui/switch";
import { useHideImages } from "@/hooks/use-hide-images";

export const Route = createFileRoute("/_authenticated/manager/products")({
  component: ProductsPage,
});

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  base_price: number | null;
  active: boolean;
  variants: Array<{
    id: string;
    variant_name: string;
    size: string | null;
    flavour: string | null;
    price: number;
    sku: string | null;
    stock: { quantity: number } | null;
  }>;
};

const SIZES = ["Small", "Medium", "Large", "XL", "One Size"] as const;
const CATEGORIES = [
  "Beverages",
  "Bakery",
  "Breakfast",
  "Dairy",
  "Groceries",
  "Household",
  "Personal Care",
  "Snacks",
  "Stationery",
  "Sweets",
  "Tobacco",
  "Other",
] as const;

type StockImportRow = { name: string; detail?: string; quantity: number; price?: number };

const STOCK_IMPORT_ROWS: StockImportRow[] = [
  { name: "Primo", quantity: 6 },
  { name: "Bela", quantity: 6, price: 4.5 },
  { name: "Pasta Gogo", quantity: 2 },
  { name: "Mum's Pasta", quantity: 5 },
  { name: "Cook More", detail: "5kg", quantity: 7 },
  { name: "Raha", detail: "5kg", quantity: 5 },
  { name: "Mr Rice", detail: "5kg", quantity: 12 },
  { name: "Basmati", detail: "5kg", quantity: 4 },
  { name: "Montero", quantity: 5, price: 4.5 },
  { name: "Mr Rice", detail: "2kg", quantity: 21 },
  { name: "Spaghetti", detail: "50c", quantity: 40, price: 0.5 },
  { name: "Cook More", detail: "2kg", quantity: 14 },
  { name: "Zimgold", quantity: 10 },
  { name: "Olivine", quantity: 17 },
  { name: "Golden Glow", quantity: 4 },
  { name: "Sun Soya", quantity: 7 },
  { name: "Puredrop", quantity: 15 },
  { name: "D'lite", detail: "750ml", quantity: 24 },
  { name: "Crosse & Blackwell", quantity: 12 },
  { name: "Cremora", quantity: 15 },
  { name: "Ellis Brown", quantity: 24 },
  { name: "Raha", detail: "2kg", quantity: 34 },
  { name: "Raha Brown", detail: "2kg", quantity: 18 },
  { name: "Top Chef", detail: "2kg", quantity: 24 },
  { name: "Huletts Sugar", detail: "2kg", quantity: 35 },
  { name: "Goldstar Sugar", detail: "2kg", quantity: 5 },
  { name: "Mega Self Raising", quantity: 12 },
  { name: "Gloria", detail: "2kg", quantity: 15 },
  { name: "Tapitapi", detail: "2kg", quantity: 26 },
  { name: "Bela Spaghetti", detail: "400g", quantity: 24 },
  { name: "Charhons", detail: "1kg", quantity: 2 },
  { name: "Charhons", detail: "500g", quantity: 5 },
  { name: "Primo", detail: "50g", quantity: 16 },
  { name: "Munchies", detail: "50g", quantity: 5 },
  { name: "Munchies", detail: "1kg", quantity: 4 },
  { name: "Mahatma Rice", detail: "2kg", quantity: 11 },
];

function ProductImagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  async function handle(files: FileList | null) {
    if (!files || !files[0]) return;
    try {
      const url = await fileToCompressedDataUrl(files[0]);
      onChange(url);
    } catch {
      toast.error("Could not read image");
    }
  }

  return (
    <div className="space-y-2">
      <Label>Product photo</Label>
      <div className="flex items-center gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-accent">
          {value ? (
            <img src={value} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <PackageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => camRef.current?.click()}>
            <Camera className="mr-2 h-4 w-4" /> Take photo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" /> Upload
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handle(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handle(e.target.files)}
        />
      </div>
    </div>
  );
}

function ProductsPage() {
  const qc = useQueryClient();
  const [openNewProduct, setOpenNewProduct] = useState(false);
  const [variantFor, setVariantFor] = useState<Product | null>(null);
  const [image, setImage] = useState("");
  const [editingVariant, setEditingVariant] = useState<{ id: string; price: number } | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editImage, setEditImage] = useState("");
  const [hideImages, setHideImages] = useHideImages();
  const [search, setSearch] = useState("");

  const products = useQuery({
    queryKey: ["products", "with-variants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, description, category, image_url, base_price, active, variants:product_variants(id, variant_name, size, flavour, price, sku, stock(quantity))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  const createProduct = useMutation({
    mutationFn: async (input: {
      name: string;
      description: string;
      category: string;
      base_price: number;
      image_url: string;
    }) => {
      const { data: existing, error: lookupError } = await supabase
        .from("products")
        .select("id")
        .ilike("name", input.name.trim())
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing)
        throw new Error(
          "A product with this name already exists. Add a variant to the existing product instead.",
        );
      const { data: user } = await supabase.auth.getUser();
      const { data: created, error } = await supabase
        .from("products")
        .insert({
          name: input.name,
          description: input.description || null,
          category: input.category || null,
          base_price: input.base_price || null,
          image_url: input.image_url || null,
          created_by: user.user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      // Stock is tracked per variant, so every new product gets a default one.
      // Without it the product would never appear on Stock or Stock-In Records.
      const { error: variantError } = await supabase.from("product_variants").insert({
        product_id: created.id,
        variant_name: "Standard",
        price: input.base_price || 0,
        image_url: input.image_url || null,
      });
      if (variantError) throw variantError;
    },
    onSuccess: () => {
      toast.success("Product created - a Standard variant was added so it appears in Stock");
      ["products", "stock", "stock-in-variants", "cashier", "alerts"].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key], refetchType: "all" }),
      );
      setOpenNewProduct(false);
      setImage("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importStock = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      let createdProducts = 0;
      let createdVariants = 0;
      let updatedStock = 0;

      for (const row of STOCK_IMPORT_ROWS) {
        const { data: existing, error: lookupError } = await supabase
          .from("products")
          .select("id, base_price")
          .ilike("name", row.name)
          .maybeSingle();
        if (lookupError) throw lookupError;

        let productId = existing?.id;
        if (!productId) {
          const { data: created, error } = await supabase
            .from("products")
            .insert({
              name: row.name,
              description: row.detail ? `${row.name} ${row.detail}` : null,
              category: "Groceries",
              base_price: row.price ?? null,
              created_by: user.user?.id,
            })
            .select("id")
            .single();
          if (error) throw error;
          productId = created.id;
          createdProducts++;
        }

        const variantName = row.detail ?? "Standard";
        const { data: variant, error: variantLookupError } = await supabase
          .from("product_variants")
          .select("id")
          .eq("product_id", productId)
          .ilike("variant_name", variantName)
          .maybeSingle();
        if (variantLookupError) throw variantLookupError;

        let variantId = variant?.id;
        if (!variantId) {
          const { data: createdVariant, error } = await supabase
            .from("product_variants")
            .insert({
              product_id: productId,
              variant_name: variantName,
              size: null,
              price: row.price ?? existing?.base_price ?? 0,
            })
            .select("id")
            .single();
          if (error) throw error;
          variantId = createdVariant.id;
          createdVariants++;
        }

        const { error: stockError } = await supabase
          .from("stock")
          .update({ quantity: row.quantity, available: row.quantity > 0 })
          .eq("variant_id", variantId);
        if (stockError) throw stockError;
        updatedStock++;
      }

      return { createdProducts, createdVariants, updatedStock };
    },
    onSuccess: ({ createdProducts, createdVariants, updatedStock }) => {
      toast.success(
        `Inventory imported: ${createdProducts} products, ${createdVariants} variants, ${updatedStock} stock levels updated`,
      );
      ["products", "stock", "stock-in-variants", "cashier", "alerts"].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key], refetchType: "all" }),
      );
    },
    onError: (e: Error) => toast.error(`Inventory import failed: ${e.message}`),
  });

  const updateProduct = useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      description: string;
      category: string;
      base_price: number;
      image_url: string;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({
          name: input.name,
          description: input.description || null,
          category: input.category || null,
          base_price: input.base_price || null,
          image_url: input.image_url || null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product updated");
      qc.invalidateQueries({ queryKey: ["products"] });
      setEditingProduct(null);
      setEditImage("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products.data ?? [];
    return (products.data ?? []).filter((p) =>
      [
        p.name,
        p.category ?? "",
        p.description ?? "",
        ...p.variants.flatMap((v) => [v.variant_name, v.sku ?? ""]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [products.data, search]);

  function openEdit(p: Product) {
    setEditingProduct(p);
    setEditImage(p.image_url ?? "");
  }
  const createVariant = useMutation({
    mutationFn: async (input: {
      product_id: string;
      variant_name: string;
      size: string;
      flavour: string;
      price: number;
      sku: string;
      initial_qty: number;
    }) => {
      const { data, error } = await supabase
        .from("product_variants")
        .insert({
          product_id: input.product_id,
          variant_name: input.variant_name,
          size: (input.size || null) as "Small" | "Medium" | "Large" | "XL" | "One Size" | null,
          flavour: input.flavour || null,
          price: input.price,
          sku: input.sku || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (input.initial_qty > 0) {
        await supabase
          .from("stock")
          .update({ quantity: input.initial_qty })
          .eq("variant_id", data.id);
      }
    },
    onSuccess: () => {
      toast.success("Variant added");
      ["products", "stock", "stock-in-variants", "cashier", "alerts"].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key], refetchType: "all" }),
      );
      setVariantFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePrice = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const { error } = await supabase.from("product_variants").update({ price }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Price updated");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      setEditingVariant(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteVariant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Variant removed");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product removed");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your catalog and variants.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hideImages ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setHideImages(false)}
              aria-label="Review product images"
            >
              <ImageIcon className="mr-2 h-4 w-4" /> Review product images
            </Button>
          ) : (
            <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <ImageOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Hide product images</span>
              <Switch checked={hideImages} onCheckedChange={setHideImages} />
            </label>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => importStock.mutate()}
            disabled={importStock.isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importStock.isPending ? "Importing stock..." : "Import stock list"}
          </Button>
          <Dialog
            open={openNewProduct}
            onOpenChange={(o) => {
              setOpenNewProduct(o);
              if (!o) setImage("");
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>New product</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createProduct.mutate({
                    name: String(fd.get("name") ?? "").trim(),
                    description: String(fd.get("description") ?? ""),
                    category: String(fd.get("category") ?? ""),
                    base_price: parseFloat(String(fd.get("base_price") ?? "0")) || 0,
                    image_url: image,
                  });
                }}
                className="space-y-4"
              >
                <ProductImagePicker value={image} onChange={setImage} />
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input name="name" required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select name="category" defaultValue="Other">
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Base price (optional)</Label>
                  <Input name="base_price" type="number" step="0.01" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea name="description" rows={3} maxLength={500} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createProduct.isPending}>
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="mb-5 max-w-xl">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products, variants, categories, or SKUs"
          aria-label="Search products"
        />
      </div>
      {products.isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : products.data?.length === 0 ? (
        <Card className="p-12 text-center">
          <PackageIcon className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">No products yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first product to get started.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProducts.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start gap-4 p-4 sm:p-5">
                {!hideImages && (
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <PackageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{p.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {p.category && <Badge variant="secondary">{p.category}</Badge>}
                        <span>
                          {p.variants.length} variant{p.variants.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {p.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setVariantFor(p)}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Variant
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => confirm(`Delete ${p.name}?`) && deleteProduct.mutate(p.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {p.variants.length > 0 && (
                    <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {p.variants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">{v.variant_name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {[v.size, v.flavour].filter(Boolean).join(" - ") || "-"}
                              {" - "}stock: {v.stock?.quantity ?? 0}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-semibold">{formatCurrency(v.price)}</span>
                            <button
                              title="Edit price"
                              onClick={() =>
                                setEditingVariant({ id: v.id, price: Number(v.price) })
                              }
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-blue-600" />
                            </button>
                            <button
                              onClick={() =>
                                confirm("Remove variant?") && deleteVariant.mutate(v.id)
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!variantFor} onOpenChange={(o) => !o && setVariantFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Add variant to {variantFor?.name}</DialogTitle>
          </DialogHeader>
          {variantFor && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createVariant.mutate({
                  product_id: variantFor.id,
                  variant_name: String(fd.get("variant_name") ?? "").trim(),
                  size: String(fd.get("size") ?? ""),
                  flavour: String(fd.get("flavour") ?? ""),
                  price: parseFloat(String(fd.get("price") ?? "0")),
                  sku: String(fd.get("sku") ?? ""),
                  initial_qty: parseInt(String(fd.get("initial_qty") ?? "0"), 10) || 0,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Variant name</Label>
                <Input name="variant_name" required placeholder="e.g. Wild Rose, Blue Ocean" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Select name="size">
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Flavour / color</Label>
                  <Input name="flavour" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input name="price" type="number" step="0.01" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label>SKU (optional)</Label>
                  <Input name="sku" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Initial stock</Label>
                <Input name="initial_qty" type="number" min="0" defaultValue="0" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createVariant.isPending}>
                  Add variant
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingVariant} onOpenChange={(o) => !o && setEditingVariant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit price</DialogTitle>
          </DialogHeader>
          {editingVariant && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const price = parseFloat(String(fd.get("price") ?? "0"));
                if (price >= 0) updatePrice.mutate({ id: editingVariant.id, price });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>New price</Label>
                <Input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editingVariant.price}
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

      <Dialog
        open={!!editingProduct}
        onOpenChange={(o) => {
          if (!o) {
            setEditingProduct(null);
            setEditImage("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateProduct.mutate({
                  id: editingProduct.id,
                  name: String(fd.get("name") ?? "").trim(),
                  description: String(fd.get("description") ?? ""),
                  category: String(fd.get("category") ?? ""),
                  base_price: parseFloat(String(fd.get("base_price") ?? "0")) || 0,
                  image_url: editImage,
                });
              }}
              className="space-y-4"
            >
              <ProductImagePicker value={editImage} onChange={setEditImage} />
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" required maxLength={100} defaultValue={editingProduct.name} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  name="category"
                  maxLength={60}
                  defaultValue={editingProduct.category ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Base price (optional)</Label>
                <Input
                  name="base_price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editingProduct.base_price ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  name="description"
                  rows={3}
                  maxLength={500}
                  defaultValue={editingProduct.description ?? ""}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateProduct.isPending}>
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

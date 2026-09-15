export type SaleUnitItem = {
  variant_id: string;
  quantity: number;
};

type VariantLike = {
  id: string;
  variant_name: string;
  product?: { name?: string | null } | null;
};

const PACK_RULES: Array<{ match: RegExp; packSize: number; source: RegExp }> = [
  { match: /maputi|smiley chips|egg|tissue|two ply|matches|crystal mints|kellogg.?s noodles|lollipop/i, packSize: 15, source: /pack|box|dozen|tray/i },
  { match: /gillette|razor/i, packSize: 5, source: /box|pack/i },
  { match: /jumbo chips/i, packSize: 10, source: /pack|bag/i },
  { match: /dandy pink gum|toffee|mint/i, packSize: 100, source: /pack|box|bag/i },
  { match: /everest|storm|pegasus|cigarette/i, packSize: 20, source: /pack|box|carton/i },
];

function text(v: VariantLike) {
  return `${v.product?.name ?? ""} ${v.variant_name}`;
}

function ruleFor(v: VariantLike) {
  return PACK_RULES.find((rule) => rule.match.test(text(v)));
}

function itemUnits(v: VariantLike, quantity: number) {
  const rule = ruleFor(v);
  if (!rule) return quantity;
  const label = v.variant_name.toLowerCase();
  if (rule.match.test(text(v)) && /7\s*(sweets?|pieces?)|\.25/.test(label)) return 7 * quantity;
  if (rule.match.test(text(v)) && /10\s*(sweets?|pieces?)|\.40/.test(label)) return 10 * quantity;
  if (rule.match.test(text(v)) && /2\s*(blades?)/.test(label)) return 2 * quantity;
  if (rule.source.test(v.variant_name)) return rule.packSize * quantity;
  return quantity;
}

/** Converts a sale into consumption of the shared source stock variant. */
export function toSourceStockDeltas(
  items: Array<SaleUnitItem>,
  variants: VariantLike[],
): SaleUnitItem[] {
  const result = new Map<string, number>();
  for (const item of items) {
    const variant = variants.find((v) => v.id === item.variant_id);
    if (!variant) {
      result.set(item.variant_id, (result.get(item.variant_id) ?? 0) + item.quantity);
      continue;
    }
    const rule = ruleFor(variant);
    if (!rule || rule.source.test(variant.variant_name)) {
      result.set(item.variant_id, (result.get(item.variant_id) ?? 0) + item.quantity);
      continue;
    }
    const source = variants.find(
      (candidate) =>
        candidate.id !== variant.id &&
        candidate.product?.name === variant.product?.name &&
        rule.source.test(candidate.variant_name),
    );
    const sourceId = source?.id ?? item.variant_id;
    const consumed = source ? itemUnits(variant, item.quantity) / rule.packSize : item.quantity;
    result.set(sourceId, (result.get(sourceId) ?? 0) + consumed);
  }
  return [...result].map(([variant_id, quantity]) => ({ variant_id, quantity }));
}

export function saleUnitDescription(v: VariantLike) {
  const rule = ruleFor(v);
  if (!rule) return null;
  return rule.source.test(v.variant_name) ? `Source stock · 1 ${rule.source.source} contains ${rule.packSize}` : `Draws from ${rule.packSize}-unit packs`;
}

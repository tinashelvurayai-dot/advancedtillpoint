import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const forecastStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI is not configured");

    // Pull 30 days of sales and current stock
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: items } = await context.supabase
      .from("sale_items")
      .select("quantity, created_at, variant:product_variants(id, variant_name, product:products(name)), sale:sales!inner(created_at)")
      .gte("created_at", since.toISOString());

    const { data: stock } = await context.supabase
      .from("stock")
      .select("quantity, low_stock_alert_level, variant:product_variants(id, variant_name, product:products(name))");

    type Line = { key: string; name: string; sold30: number; stock: number };
    const map = new Map<string, Line>();
    (stock ?? []).forEach((s: any) => {
      const key = s.variant?.id;
      if (!key) return;
      const name = `${s.variant?.product?.name ?? ""} - ${s.variant?.variant_name ?? ""}`.trim();
      map.set(key, { key, name, sold30: 0, stock: s.quantity });
    });
    (items ?? []).forEach((it: any) => {
      const key = it.variant?.id;
      if (!key) return;
      const entry = map.get(key) ?? { key, name: `${it.variant?.product?.name ?? ""} - ${it.variant?.variant_name ?? ""}`.trim(), sold30: 0, stock: 0 };
      entry.sold30 += Number(it.quantity);
      map.set(key, entry);
    });

    const rows = Array.from(map.values())
      .map((r) => {
        const perDay = r.sold30 / 30;
        const daysLeft = perDay > 0 ? r.stock / perDay : Infinity;
        return { ...r, perDay, daysLeft };
      })
      .filter((r) => r.sold30 > 0 || r.stock > 0)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const topRisk = rows.filter((r) => Number.isFinite(r.daysLeft)).slice(0, 15);

    // Ask AI for narrative insight
    let insight = "";
    try {
      const summary = topRisk.map((r) => `${r.name}: ${r.stock} in stock, ${r.sold30} sold last 30d, ~${r.daysLeft.toFixed(1)} days left`).join("\n");
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an inventory analyst for a small retail shop in Zimbabwe. Be concise and practical. Reply in 4-6 short bullet points." },
            { role: "user", content: `Based on this stock/sales data, tell me:\n- which items will run out first and when\n- which items are overstocked\n- one restocking recommendation\n\nData:\n${summary || "No sales in the last 30 days."}` },
          ],
        }),
      });
      if (res.ok) {
        const j = await res.json();
        insight = j.choices?.[0]?.message?.content ?? "";
      }
    } catch { /* noop */ }

    return { rows, insight };
  });

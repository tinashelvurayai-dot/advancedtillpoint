// Editable, downloadable payment receipt shown under the handover agreement.
// Everything is stored on the device and rendered offline.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Printer, Save, Plus, Trash2, ReceiptText } from "lucide-react";
import { toast } from "sonner";

const KEY = "tillpoint.handover.receipt.v1";

type Line = { id: string; description: string; qty: string; unit: string };

type ReceiptForm = {
  receiptNo: string;
  date: string;
  issuedBy: string;
  issuedContact: string;
  billedTo: string;
  billedContact: string;
  currency: string;
  paymentMethod: string;
  reference: string;
  notes: string;
  lines: Line[];
};

const initial: ReceiptForm = {
  receiptNo: "TP-HANDOVER-001",
  date: "17 August 2026",
  issuedBy: "TillPoint Developers",
  issuedContact: "codedevelopers151@gmail.com",
  billedTo: "Mr Pride Tatire",
  billedContact: "+263 77 688 9832",
  currency: "USD",
  paymentMethod: "Cash",
  reference: "Final handover payment",
  notes: "Payment received in full for the TillPoint Retail OS handover. Thank you for your business.",
  lines: [
    {
      id: "l1",
      description: "TillPoint Retail OS - full system licence (one-time)",
      qty: "1",
      unit: "170.00",
    },
  ],
};

function read(): ReceiptForm {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<ReceiptForm>;
    return { ...initial, ...parsed, lines: parsed.lines?.length ? parsed.lines : initial.lines };
  } catch {
    return initial;
  }
}

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const lineTotal = (l: Line) => (parseFloat(l.qty) || 0) * (parseFloat(l.unit) || 0);

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(f: ReceiptForm, origin: string) {
  const total = f.lines.reduce((s, l) => s + lineTotal(l), 0);
  const rows = f.lines
    .map(
      (l) => `<tr>
      <td>${esc(l.description)}</td>
      <td class="num">${esc(l.qty)}</td>
      <td class="num">${esc(money(parseFloat(l.unit) || 0, f.currency))}</td>
      <td class="num">${esc(money(lineTotal(l), f.currency))}</td>
    </tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(f.receiptNo)}</title>
<style>
  @page{margin:16mm}
  body{font-family:Georgia,'Times New Roman',serif;color:#0f172a;margin:0;padding:28px}
  .sheet{max-width:760px;margin:0 auto;border:1px solid #e2e8f0;border-radius:14px;padding:34px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:3px solid #1e40af;padding-bottom:18px}
  .brand{display:flex;gap:12px;align-items:center}
  .brand img{width:52px;height:52px;object-fit:contain}
  .brand .n{font-size:22px;font-weight:700;letter-spacing:-.3px}
  .brand .s{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#64748b}
  h1{font-size:26px;margin:0;text-align:right;letter-spacing:.04em}
  .meta{font-size:12px;color:#475569;text-align:right;margin-top:6px;line-height:1.6}
  .parties{display:flex;gap:32px;margin-top:24px;font-size:13px;line-height:1.7}
  .parties h3{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin:0 0 4px}
  table{width:100%;border-collapse:collapse;margin-top:26px;font-size:13px}
  th{text-align:left;background:#f1f5f9;padding:10px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#334155}
  td{padding:10px;border-bottom:1px solid #e2e8f0}
  .num{text-align:right}
  .total{margin-top:18px;text-align:right;font-size:20px;font-weight:700}
  .paid{display:inline-block;margin-top:12px;border:2px solid #059669;color:#059669;border-radius:8px;padding:6px 16px;font-size:13px;letter-spacing:.24em;text-transform:uppercase}
  .notes{margin-top:24px;font-size:12px;color:#475569;line-height:1.7}
  .sign{display:flex;gap:40px;margin-top:44px;font-size:12px;color:#475569}
  .sign div{flex:1;border-top:1px solid #94a3b8;padding-top:6px}
</style></head><body><div class="sheet">
  <div class="head">
    <div class="brand">
      <img src="${origin}/icons/icon-192.png" alt="TillPoint logo" />
      <div><div class="n">TillPoint</div><div class="s">Retail OS</div></div>
    </div>
    <div>
      <h1>RECEIPT</h1>
      <div class="meta">No. ${esc(f.receiptNo)}<br/>Date: ${esc(f.date)}<br/>Reference: ${esc(f.reference)}</div>
    </div>
  </div>
  <div class="parties">
    <div><h3>Issued by</h3>${esc(f.issuedBy)}<br/>${esc(f.issuedContact)}</div>
    <div><h3>Received from</h3>${esc(f.billedTo)}<br/>${esc(f.billedContact)}</div>
    <div><h3>Payment method</h3>${esc(f.paymentMethod)}</div>
  </div>
  <table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="total">Total: ${esc(money(total, f.currency))}</div>
  <div style="text-align:right"><span class="paid">Paid in full</span></div>
  <div class="notes">${esc(f.notes)}</div>
  <div class="sign"><div>Developer signature</div><div>Client signature</div></div>
</div></body></html>`;
}

export function HandoverReceipt() {
  const [form, setForm] = useState<ReceiptForm>(read);
  const update = <K extends keyof ReceiptForm>(k: K, v: ReceiptForm[K]) =>
    setForm((c) => ({ ...c, [k]: v }));
  const updateLine = (id: string, patch: Partial<Line>) =>
    setForm((c) => ({ ...c, lines: c.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const total = form.lines.reduce((s, l) => s + lineTotal(l), 0);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(form));
    toast.success("Receipt saved on this device.");
  };

  const download = () => {
    const blob = new Blob([buildHtml(form, origin)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.receiptNo || "TillPoint-receipt"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const print = () => {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) {
      toast.error("Allow pop-ups to print the receipt.");
      return;
    }
    w.document.write(buildHtml(form, origin));
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <Card className="mx-auto mt-8 max-w-5xl border-amber-200/70 bg-white p-6 shadow-2xl md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-blue-800 pb-5">
        <div className="flex items-center gap-3">
          <img
            src="/icons/icon-192.png"
            alt="TillPoint logo"
            width={52}
            height={52}
            className="h-13 w-13 object-contain"
          />
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-950">TillPoint</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Retail OS</div>
          </div>
        </div>
        <div className="text-right">
          <h2 className="flex items-center justify-end gap-2 font-serif text-3xl font-semibold tracking-wide text-slate-950">
            <ReceiptText className="h-6 w-6 text-blue-800" /> RECEIPT
          </h2>
          <p className="mt-1 text-xs text-slate-500">Editable · downloadable · printable</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Receipt number</Label>
          <Input value={form.receiptNo} onChange={(e) => update("receiptNo", e.target.value)} />
        </div>
        <div>
          <Label>Date</Label>
          <Input value={form.date} onChange={(e) => update("date", e.target.value)} />
        </div>
        <div>
          <Label>Reference</Label>
          <Input value={form.reference} onChange={(e) => update("reference", e.target.value)} />
        </div>
        <div>
          <Label>Issued by</Label>
          <Input value={form.issuedBy} onChange={(e) => update("issuedBy", e.target.value)} />
        </div>
        <div>
          <Label>Issuer contact</Label>
          <Input
            value={form.issuedContact}
            onChange={(e) => update("issuedContact", e.target.value)}
          />
        </div>
        <div>
          <Label>Payment method</Label>
          <Input
            value={form.paymentMethod}
            onChange={(e) => update("paymentMethod", e.target.value)}
          />
        </div>
        <div>
          <Label>Received from</Label>
          <Input value={form.billedTo} onChange={(e) => update("billedTo", e.target.value)} />
        </div>
        <div>
          <Label>Client contact</Label>
          <Input
            value={form.billedContact}
            onChange={(e) => update("billedContact", e.target.value)}
          />
        </div>
        <div>
          <Label>Currency</Label>
          <Input value={form.currency} onChange={(e) => update("currency", e.target.value)} />
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold text-slate-950">Items</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setForm((c) => ({
                ...c,
                lines: [
                  ...c.lines,
                  { id: `l${Date.now()}`, description: "", qty: "1", unit: "0.00" },
                ],
              }))
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add line
          </Button>
        </div>
        <div className="space-y-3">
          {form.lines.map((l) => (
            <div key={l.id} className="grid gap-2 sm:grid-cols-[1fr_80px_120px_120px_40px]">
              <Input
                placeholder="Description"
                value={l.description}
                onChange={(e) => updateLine(l.id, { description: e.target.value })}
              />
              <Input
                inputMode="decimal"
                value={l.qty}
                onChange={(e) => updateLine(l.id, { qty: e.target.value })}
              />
              <Input
                inputMode="decimal"
                value={l.unit}
                onChange={(e) => updateLine(l.id, { unit: e.target.value })}
              />
              <div className="flex items-center justify-end px-2 text-sm font-semibold text-slate-800">
                {money(lineTotal(l), form.currency)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove line"
                onClick={() =>
                  setForm((c) => ({
                    ...c,
                    lines: c.lines.length > 1 ? c.lines.filter((x) => x.id !== l.id) : c.lines,
                  }))
                }
              >
                <Trash2 className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-4 border-t border-slate-200 pt-4">
          <span className="text-sm uppercase tracking-[0.16em] text-slate-500">Total</span>
          <span className="text-2xl font-bold text-slate-950">{money(total, form.currency)}</span>
        </div>
        <div className="mt-2 flex justify-end">
          <span className="rounded-md border-2 border-emerald-600 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
            Paid in full
          </span>
        </div>
      </div>

      <div className="mt-6">
        <Label>Notes</Label>
        <Textarea rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-6">
        <Button variant="outline" onClick={save}>
          <Save className="mr-2 h-4 w-4" /> Save receipt
        </Button>
        <Button variant="outline" onClick={print}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
        <Button onClick={download}>
          <Download className="mr-2 h-4 w-4" /> Download receipt
        </Button>
      </div>
    </Card>
  );
}

// Receipt rendering. Works fully offline: everything is generated from the
// local transaction log, printed through the browser, or saved as a file.
import type { TxLogEntry } from "@/lib/transaction-log";
import { formatCurrency } from "@/lib/format";

export const SHOP_NAME = "Green Shop";

export type ReceiptExtras = { amountPaid?: number; change?: number };

export function receiptNumber(entry: TxLogEntry): string {
  return `R-${entry.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function receiptText(entry: TxLogEntry, extras: ReceiptExtras = {}): string {
  const d = new Date(entry.created_at);
  const lines: string[] = [];
  lines.push(SHOP_NAME.toUpperCase());
  lines.push("-".repeat(34));
  lines.push(`Date:    ${d.toLocaleDateString()}`);
  lines.push(`Time:    ${d.toLocaleTimeString()}`);
  lines.push(`Cashier: ${entry.cashier_name}`);
  lines.push(`Receipt: ${receiptNumber(entry)}`);
  lines.push("-".repeat(34));
  for (const i of entry.items) {
    lines.push(`${i.name} ${i.variant ? `(${i.variant})` : ""}`.trim());
    lines.push(`  ${i.quantity} x ${formatCurrency(i.unit_price)}   ${formatCurrency(i.subtotal)}`);
  }
  lines.push("-".repeat(34));
  lines.push(`TOTAL            ${formatCurrency(entry.total)}`);
  if (extras.amountPaid != null)
    lines.push(`PAID             ${formatCurrency(extras.amountPaid)}`);
  if (extras.change != null) lines.push(`CHANGE           ${formatCurrency(extras.change)}`);
  lines.push(`Payment: ${entry.payment_type}`);
  lines.push("-".repeat(34));
  lines.push("Thank you for shopping with us!");
  return lines.join("\n");
}

export function receiptHtml(entry: TxLogEntry, extras: ReceiptExtras = {}): string {
  const body = receiptText(entry, extras).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${receiptNumber(entry)}</title>
<style>@page{margin:6mm}body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;white-space:pre;margin:0}</style>
</head><body>${body}</body></html>`;
}

/** Opens the browser print dialog with a thermal-style receipt. Offline-safe. */
export function printReceipt(entry: TxLogEntry, extras: ReceiptExtras = {}) {
  if (typeof window === "undefined") return;
  const html = receiptHtml(entry, extras);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const done = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      /* noop */
    }
    setTimeout(() => {
      try {
        document.body.removeChild(frame);
      } catch {
        /* noop */
      }
    }, 1000);
  };
  if (doc.readyState === "complete") done();
  else frame.onload = done;
}

/**
 * Saves the receipt as a printable document. The browser's own "Save as PDF"
 * target in the print dialog is used when a printer is not connected, and this
 * download gives a permanent copy without any network call.
 */
export function downloadReceipt(entry: TxLogEntry, extras: ReceiptExtras = {}) {
  if (typeof window === "undefined") return;
  const blob = new Blob([receiptHtml(entry, extras)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${receiptNumber(entry)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}


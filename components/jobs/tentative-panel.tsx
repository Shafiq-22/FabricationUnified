"use client";

import { formatAED } from "@/lib/utils";

export interface TentativeItem {
  name: string;
  unit: string | null;
  qty: number | null;
  kind: "Material" | "Consumable";
}
export interface HistoricLookup {
  [itemKey: string]: { avg: number | null; last: number | null };
}

// Read-only estimator: re-prices the job's MTO items from historic procurement
// data for a quick indicative quote.
export function TentativePanel({
  items,
  historic,
}: {
  items: TentativeItem[];
  historic: HistoricLookup;
}) {
  const rows = items.map((it) => {
    const h = historic[it.name.trim().toLowerCase()];
    const price = h?.avg ?? h?.last ?? null;
    const total = price != null && it.qty != null ? price * it.qty : null;
    return { ...it, price, total, matched: !!h };
  });
  const indicative = rows.reduce((s, r) => s + (r.total ?? 0), 0);

  return (
    <div className="panel-surface">
      <div className="border-b border-panel-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">
          Tentative Quotation (historic prices)
        </h3>
        <p className="text-[11px] text-panel-foreground/60">
          Indicative unit costs sourced from past procurement for the items in this job&apos;s MTO.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular">
          <thead>
            <tr className="header-band border-b border-panel-border">
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Item</th>
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Type</th>
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Unit</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Qty</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Historic Unit</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Indicative Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-panel-foreground/50">
                  Add Material/Consumable lines in the Quotation tab first.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-panel-border/60">
                <td className="px-2 py-1">{r.name || "—"}</td>
                <td className="px-2 py-1 text-panel-foreground/60">{r.kind}</td>
                <td className="px-2 py-1">{r.unit}</td>
                <td className="px-2 py-1 text-right">{r.qty}</td>
                <td className="px-2 py-1 text-right">
                  {r.price != null ? formatAED(r.price) : <span className="text-panel-foreground/40">no history</span>}
                </td>
                <td className="px-2 py-1 text-right font-medium">
                  {r.total != null ? formatAED(r.total) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-panel-border font-semibold">
              <td colSpan={5} className="px-2 py-1.5 text-right uppercase">
                Indicative quote (before margin)
              </td>
              <td className="px-2 py-1.5 text-right">{formatAED(indicative)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

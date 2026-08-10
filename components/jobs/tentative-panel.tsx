"use client";

import { formatAED } from "@/lib/utils";

export interface TentativeItem {
  name: string;
  unit: string | null;
  qty: number | null;
  kind: "Material" | "Consumable";
}
export interface HistoricLookup {
  [itemKey: string]: { avg: number | null; last: number | null; date?: string | null };
}

/**
 * Age a historic price forward to today at the yearly rate, compounded
 * pro-rata by the number of days since the purchase. A price under a month
 * old is left alone — the shop treats that as current.
 */
export function inflate(
  price: number,
  priceDate: string | null | undefined,
  yearlyPct: number,
): { adjusted: number; ageDays: number | null; applied: boolean } {
  if (!priceDate || yearlyPct === 0) return { adjusted: price, ageDays: null, applied: false };
  const then = new Date(priceDate);
  if (Number.isNaN(then.getTime())) return { adjusted: price, ageDays: null, applied: false };
  const ageDays = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (ageDays < 30) return { adjusted: price, ageDays, applied: false };
  const adjusted = price * Math.pow(1 + yearlyPct / 100, ageDays / 365);
  return { adjusted, ageDays, applied: true };
}

// Read-only estimator: re-prices the job's MTO items from historic procurement
// data for a quick indicative quote.
export function TentativePanel({
  items,
  historic,
  inflationPct = 0,
}: {
  items: TentativeItem[];
  historic: HistoricLookup;
  /** Yearly inflation from Settings, applied to the age of each price. */
  inflationPct?: number;
}) {
  const rows = items.map((it) => {
    const h = historic[it.name.trim().toLowerCase()];
    const price = h?.avg ?? h?.last ?? null;
    const inf = price != null ? inflate(price, h?.date, inflationPct) : null;
    const adjusted = inf?.adjusted ?? null;
    const total = adjusted != null && it.qty != null ? adjusted * it.qty : null;
    return { ...it, price, adjusted, ageDays: inf?.ageDays ?? null, applied: inf?.applied ?? false, total, matched: !!h };
  });
  const indicative = rows.reduce((s, r) => s + (r.total ?? 0), 0);

  return (
    <div className="panel-surface">
      <div className="border-b border-panel-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">
          Tentative Quotation (historic prices)
        </h3>
        <p className="text-[11px] text-panel-foreground/60">
          Indicative unit costs from past procurement, aged forward to today at{" "}
          {inflationPct}% a year. Prices under a month old are used as they stand.
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
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Age</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Today&apos;s Unit</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Indicative Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-panel-foreground/50">
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
                <td className="px-2 py-1 text-right text-panel-foreground/60">
                  {r.ageDays == null ? "—" : r.ageDays < 30 ? "current" : `${Math.round(r.ageDays / 30)} mo`}
                </td>
                <td className="px-2 py-1 text-right">
                  {r.adjusted == null ? (
                    "—"
                  ) : (
                    <span
                      className={r.applied ? "text-amber" : undefined}
                      title={r.applied ? `Aged forward ${r.ageDays} days at ${inflationPct}%/yr` : undefined}
                    >
                      {formatAED(r.adjusted)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 text-right font-medium">
                  {r.total != null ? formatAED(r.total) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-panel-border font-semibold">
              <td colSpan={7} className="px-2 py-1.5 text-right uppercase">
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

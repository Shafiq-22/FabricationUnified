"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAED, formatPercent } from "@/lib/utils";

export interface CategoryDeviation {
  name: string;
  quote: number; // quoted cost (sub-total, no margin)
  actual: number; // actual cost
}

export function AnalyticsPanel({
  quoteBeforeMargin,
  finalQuote,
  marginPct,
  actualCost,
  categories,
}: {
  quoteBeforeMargin: number;
  finalQuote: number;
  marginPct: number;
  actualCost: number | null;
  categories: CategoryDeviation[];
}) {
  const predictedPL = finalQuote - quoteBeforeMargin; // expected profit (the margin)
  const actualPL = actualCost == null ? null : finalQuote - actualCost;

  const stat = (label: string, value: string, tone: "neutral" | "pos" | "neg" = "neutral") => (
    <div className="border border-border bg-card p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold tabular ${
          tone === "pos" ? "text-status-com" : tone === "neg" ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stat("Quote (before margin)", formatAED(quoteBeforeMargin))}
        {stat("Margin %", formatPercent(marginPct / 100))}
        {stat("Final Quote", formatAED(finalQuote), "pos")}
        {stat("Actual Cost", actualCost == null ? "—" : formatAED(actualCost))}
        {stat("Predicted P/L", formatAED(predictedPL), predictedPL >= 0 ? "pos" : "neg")}
        {stat(
          "Actual P/L",
          actualPL == null ? "—" : formatAED(actualPL),
          actualPL == null ? "neutral" : actualPL >= 0 ? "pos" : "neg",
        )}
      </div>

      <div className="border border-border bg-card p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cost Deviation — Quoted vs Actual (by category)
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 22% 88%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(213 14% 40%)" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(213 14% 40%)" width={70} />
              <Tooltip
                formatter={(v: number) => `${formatAED(v)} AED`}
                contentStyle={{ fontSize: 12, borderColor: "hsl(214 22% 83%)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="quote" name="Quoted cost" fill="hsl(197 73% 35%)" />
              <Bar dataKey="actual" name="Actual cost" fill="hsl(22 81% 55%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Bars above the quoted cost indicate overruns; below indicate savings.
        </p>
      </div>
    </div>
  );
}

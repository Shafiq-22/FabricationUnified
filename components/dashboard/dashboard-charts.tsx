"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAED } from "@/lib/utils";

export interface MonthPoint {
  month: string;
  label: string;
  jobs: number;
  quoted: number;
  actual: number;
  pl: number;
}

export interface SlicePoint {
  name: string;
  value: number;
  colour: string;
}

const TEAL = "#156082";
const ORANGE = "#E97132";
const NAVY = "#0E2841";
const GREY = "#8b98a8";

const axis = { fontSize: 10, fill: GREY } as const;

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="h-64 p-3">{children}</div>
    </section>
  );
}

/** Quoted vs actual with profit/loss over the trailing months. Tier 2+ only. */
export function FinanceChart({ data }: { data: MonthPoint[] }) {
  const money = (v: number) => formatAED(v);
  return (
    <Panel
      title="Finance"
      subtitle="Quoted against actual cost, with profit/loss, by month"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
          <YAxis
            tick={axis}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />
          <Tooltip
            formatter={(v: number, name: string) => [money(v), name]}
            contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #c9d2dd" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="quoted" name="Quoted" fill={TEAL} maxBarSize={26} />
          <Bar dataKey="actual" name="Actual Cost" fill={ORANGE} maxBarSize={26} />
          <Line
            type="monotone"
            dataKey="pl"
            name="Profit / Loss"
            stroke={NAVY}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  );
}

/** Job count per month — non-financial, so every tier sees it. */
export function JobVolumeChart({ data }: { data: MonthPoint[] }) {
  return (
    <Panel title="Job Volume" subtitle="Jobs raised per month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #c9d2dd" }}
          />
          <Bar dataKey="jobs" name="Jobs" fill={TEAL} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

/** Where the open work sits. */
export function StatusMixChart({ data }: { data: SlicePoint[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Panel title="Status Mix" subtitle={`${total} job(s) in the selected month`}>
      {total === 0 ? (
        <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
          No jobs in this month.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="45%"
              outerRadius="75%"
              paddingAngle={1}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.colour} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #c9d2dd" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

/** Which sites the workshop is feeding. */
export function SiteLoadChart({ data }: { data: { site: string; jobs: number }[] }) {
  return (
    <Panel title="Load by Site" subtitle="Jobs per site across the last 12 months">
      {data.length === 0 ? (
        <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
          No jobs yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 16, bottom: 0, left: 8 }}
          >
            <CartesianGrid stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="site"
              tick={axis}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              width={56}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #c9d2dd" }}
            />
            <Bar dataKey="jobs" name="Jobs" fill={ORANGE} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSeeFinancials, statusMeta, JOB_STATUSES, type JobView } from "@/lib/types";
import { currentMonthKey, monthLabel } from "@/lib/date";
import { formatAED } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import {
  FinanceChart,
  JobVolumeChart,
  StatusMixChart,
  SiteLoadChart,
  type MonthPoint,
  type SlicePoint,
} from "@/components/dashboard/dashboard-charts";

export const dynamic = "force-dynamic";

interface Kpis {
  authorized: boolean;
  gross_pl?: number;
  total_daywork?: number;
  consumables_total?: number;
  avg_supplier_lead_time?: number | null;
}

const monthOf = (j: JobView) => (j.start_date ?? j.created_at ?? "").slice(0, 7);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const profile = await getProfile();
  const month = searchParams.month ?? currentMonthKey();
  const supabase = createClient();

  // final_quote / actual_cost come back NULL for Tier 1 straight from the
  // masking view, so the finance series simply has nothing to plot for them.
  const { data: allJobs } = await supabase
    .from("jobs_view")
    .select("id, status, start_date, created_at, site_code, final_quote, actual_cost, profit_loss")
    .order("created_at", { ascending: false })
    .limit(5000);

  const jobs = (allJobs ?? []) as JobView[];
  const monthJobs = jobs.filter((j) => monthOf(j) === month);
  const total = monthJobs.length || 1;
  const counts = Object.fromEntries(
    JOB_STATUSES.map((s) => [s.value, monthJobs.filter((j) => j.status === s.value).length]),
  ) as Record<string, number>;

  // Trailing 12 months ending with the selected one.
  const series: MonthPoint[] = lastMonths(month, 12).map((m) => {
    const inMonth = jobs.filter((j) => monthOf(j) === m);
    return {
      month: m,
      label: shortMonth(m),
      jobs: inMonth.length,
      quoted: sum(inMonth, (j) => j.final_quote),
      actual: sum(inMonth, (j) => j.actual_cost),
      pl: sum(inMonth, (j) => j.profit_loss),
    };
  });

  const statusMix: SlicePoint[] = JOB_STATUSES.map((s) => ({
    name: s.label,
    value: counts[s.value],
    colour: STATUS_COLOURS[s.value],
  })).filter((s) => s.value > 0);

  const windowStart = series[0]?.month ?? "";
  const siteCounts = new Map<string, number>();
  for (const j of jobs) {
    if (monthOf(j) < windowStart) continue;
    const key = j.site_code ?? "—";
    siteCounts.set(key, (siteCounts.get(key) ?? 0) + 1);
  }
  const siteLoad = Array.from(siteCounts.entries())
    .map(([site, n]) => ({ site, jobs: n }))
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 8);

  const showMoney = canSeeFinancials(profile.role_tier);
  let kpis: Kpis = { authorized: false };
  if (showMoney) {
    const { data } = await supabase.rpc("dashboard_financial_kpis", { p_month: month });
    kpis = (data as unknown as Kpis) ?? { authorized: false };
  }

  // Operational counters (non-financial, so every tier sees them).
  const [{ count: lowStock }, { count: openNcrs }, { count: docCount }, { data: pending }] =
    await Promise.all([
      supabase.from("inventory_low_stock").select("id", { count: "exact", head: true }),
      supabase
        .from("ncrs")
        .select("id", { count: "exact", head: true })
        .neq("status", "closed")
        .is("deleted_at", null),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("job_materials")
        .select("order_date")
        .is("delivery_date", null)
        .not("order_date", "is", null)
        .is("deleted_at", null)
        .limit(1000),
    ]);

  // "Overdue" = ordered more than 14 days ago and still not delivered.
  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const overdueDeliveries = (pending ?? []).filter(
    (r: { order_date: string | null }) => (r.order_date ?? "") < cutoff,
  ).length;

  return (
    <div>
      <PageHeader title="Dashboard" description={`Workshop performance — ${monthLabel(month)}`}>
        <MonthSelector value={month} />
      </PageHeader>

      <div className="space-y-6 p-6">
        {/* KPI row — numbers only */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard label="No. of Jobs" value={String(monthJobs.length)} accent="neutral" />
          {showMoney && kpis.authorized ? (
            <>
              <KpiCard
                label="Gross P/L"
                value={formatAED(kpis.gross_pl ?? 0)}
                unit="AED"
                accent={(kpis.gross_pl ?? 0) >= 0 ? "positive" : "negative"}
              />
              <KpiCard label="Daywork Charges" value={formatAED(kpis.total_daywork ?? 0)} unit="AED" accent="steel" />
              <KpiCard label="Consumables Cost" value={formatAED(kpis.consumables_total ?? 0)} unit="AED" accent="amber" />
              <KpiCard
                label="Avg Lead Time"
                value={kpis.avg_supplier_lead_time != null ? String(kpis.avg_supplier_lead_time) : "—"}
                unit="days"
                accent="steel"
              />
            </>
          ) : (
            <div className="col-span-2 flex items-center border border-dashed border-border bg-card px-4 text-xs text-muted-foreground lg:col-span-4">
              Financial figures are restricted for your role.
            </div>
          )}
        </div>

        {/* Operational counters */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link href="/inventory">
            <KpiCard
              label="Low Stock"
              value={String(lowStock ?? 0)}
              accent={(lowStock ?? 0) > 0 ? "negative" : "positive"}
            />
          </Link>
          <Link href="/qa?tab=ncrs">
            <KpiCard
              label="Open NCRs"
              value={String(openNcrs ?? 0)}
              accent={(openNcrs ?? 0) > 0 ? "negative" : "positive"}
            />
          </Link>
          <Link href="/procurement">
            <KpiCard
              label="Overdue Deliveries"
              value={String(overdueDeliveries)}
              accent={overdueDeliveries > 0 ? "amber" : "positive"}
            />
          </Link>
          <Link href="/documents">
            <KpiCard label="Documents" value={String(docCount ?? 0)} accent="steel" />
          </Link>
        </div>

        {/* Graphs */}
        <div className="grid gap-3 xl:grid-cols-2">
          {showMoney && <FinanceChart data={series} />}
          <JobVolumeChart data={series} />
          <StatusMixChart data={statusMix} />
          <SiteLoadChart data={siteLoad} />
        </div>

        {/* Status breakdown */}
        <section className="border border-border bg-card">
          <h2 className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status Breakdown
          </h2>
          <div className="grid grid-cols-2 divide-border sm:grid-cols-3 sm:divide-x lg:grid-cols-5">
            {JOB_STATUSES.map((s) => (
              <div key={s.value} className="border-t border-border p-4 sm:border-t-0">
                <div className="flex items-center justify-between">
                  <JobStatusBadge status={s.value} />
                  <span className="text-2xl font-semibold tabular">{counts[s.value]}</span>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {statusMeta(s.value).label} · {Math.round((counts[s.value] / total) * 100)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const STATUS_COLOURS: Record<string, string> = {
  quotation: "#FFC000",
  in_progress: "#156082",
  completed: "#00B050",
  delivered: "#0E2841",
  halt: "#E97132",
};

function sum(rows: JobView[], pick: (j: JobView) => number | null) {
  return rows.reduce((s, r) => s + Number(pick(r) ?? 0), 0);
}

/** The `count` months ending at `end` (YYYY-MM), oldest first. */
function lastMonths(end: string, count: number): string[] {
  const [y, m] = end.split("-").map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function shortMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

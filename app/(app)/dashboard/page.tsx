import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSeeFinancials, statusMeta, JOB_STATUSES, type JobView } from "@/lib/types";
import { currentMonthKey, monthLabel } from "@/lib/date";
import { formatAED } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";

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

  const { data: allJobs } = await supabase
    .from("jobs_view")
    .select("id, status, start_date, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  const jobs = (allJobs ?? []) as JobView[];
  const monthJobs = jobs.filter((j) => monthOf(j) === month);
  const total = monthJobs.length || 1;
  const counts = Object.fromEntries(
    JOB_STATUSES.map((s) => [s.value, monthJobs.filter((j) => j.status === s.value).length]),
  ) as Record<string, number>;

  const showMoney = canSeeFinancials(profile.role_tier);
  let kpis: Kpis = { authorized: false };
  if (showMoney) {
    const { data } = await supabase.rpc("dashboard_financial_kpis", { p_month: month });
    kpis = (data as unknown as Kpis) ?? { authorized: false };
  }

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

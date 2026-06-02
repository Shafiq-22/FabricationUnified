import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSeeFinancials, statusMeta, type JobView } from "@/lib/types";
import { currentMonthKey, monthLabel, fmtDate } from "@/lib/date";
import { formatAED } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface Kpis {
  authorized: boolean;
  gross_pl?: number;
  total_pl?: number;
  total_daywork?: number;
  charges_to_baf?: number;
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
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  const jobs = (allJobs ?? []) as JobView[];
  const monthJobs = jobs.filter((j) => monthOf(j) === month);

  const counts = {
    quotation: monthJobs.filter((j) => j.status === "quotation").length,
    in_progress: monthJobs.filter((j) => j.status === "in_progress").length,
    completed: monthJobs.filter((j) => j.status === "completed").length,
    delivered: monthJobs.filter((j) => j.status === "delivered").length,
  };
  const total = monthJobs.length || 1;

  const daywork = monthJobs.filter((j) => j.status === "delivered");
  const inHand = monthJobs.filter(
    (j) => j.status === "in_progress" || j.status === "quotation",
  );

  const showMoney = canSeeFinancials(profile.role_tier);
  let kpis: Kpis = { authorized: false };
  if (showMoney) {
    const { data } = await supabase.rpc("dashboard_financial_kpis", {
      p_month: month,
    });
    kpis = (data as unknown as Kpis) ?? { authorized: false };
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Workshop performance — ${monthLabel(month)}`}
      >
        <MonthSelector value={month} />
      </PageHeader>

      <div className="space-y-6 p-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Jobs This Month" value={String(monthJobs.length)} accent="neutral" />
          {showMoney && kpis.authorized ? (
            <>
              <KpiCard
                label="Gross P/L"
                value={formatAED(kpis.gross_pl ?? 0)}
                unit="AED"
                accent={(kpis.gross_pl ?? 0) >= 0 ? "positive" : "negative"}
              />
              <KpiCard
                label="Total Daywork"
                value={formatAED(kpis.total_daywork ?? 0)}
                unit="AED"
                accent="steel"
              />
              <KpiCard
                label="Charges to BAF"
                value={formatAED(kpis.charges_to_baf ?? 0)}
                unit="AED"
                accent="amber"
              />
              <KpiCard
                label="Consumables"
                value={formatAED(kpis.consumables_total ?? 0)}
                unit="AED"
                accent="amber"
              />
              <KpiCard
                label="Avg Lead Time"
                value={
                  kpis.avg_supplier_lead_time != null
                    ? String(kpis.avg_supplier_lead_time)
                    : "—"
                }
                unit="days"
                accent="steel"
              />
            </>
          ) : (
            <div className="col-span-2 flex items-center border border-dashed border-border bg-card px-4 text-xs text-muted-foreground lg:col-span-5 xl:col-span-5">
              Financial figures are restricted for your role.
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <section className="border border-border bg-card">
          <h2 className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status Breakdown
          </h2>
          <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
            {(["quotation", "in_progress", "completed", "delivered"] as const).map(
              (s) => (
                <div key={s} className="p-4">
                  <div className="flex items-center justify-between">
                    <JobStatusBadge status={s} />
                    <span className="text-2xl font-semibold tabular">
                      {counts[s]}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {statusMeta(s).label} ·{" "}
                    {Math.round((counts[s] / total) * 100)}%
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        {/* Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          <JobsMiniTable
            title="Daywork (Delivered)"
            jobs={daywork}
            showMoney={showMoney}
          />
          <JobsMiniTable
            title="Jobs In Hand"
            jobs={inHand}
            showMoney={showMoney}
          />
        </div>
      </div>
    </div>
  );
}

function JobsMiniTable({
  title,
  jobs,
  showMoney,
}: {
  title: string;
  jobs: JobView[];
  showMoney: boolean;
}) {
  return (
    <section className="border border-border bg-card">
      <h2 className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} <span className="text-muted-foreground/60">({jobs.length})</span>
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job Code</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Description</TableHead>
            {showMoney && <TableHead className="text-right">Final Quote</TableHead>}
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={showMoney ? 5 : 4}
                className="py-6 text-center text-xs text-muted-foreground"
              >
                No jobs.
              </TableCell>
            </TableRow>
          )}
          {jobs.map((j) => (
            <TableRow key={j.id ?? ""}>
              <TableCell>
                <Link
                  href={`/jobs/${j.id}/worksheet`}
                  className="code-chip text-steel hover:underline"
                >
                  {j.job_code}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs">{j.site_code}</TableCell>
              <TableCell className="max-w-[16rem] truncate text-xs">
                {j.description}
              </TableCell>
              {showMoney && (
                <TableCell className="text-right tabular text-xs">
                  {formatAED(j.final_quote)}
                </TableCell>
              )}
              <TableCell className="text-xs text-muted-foreground">
                {fmtDate(j.start_date)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

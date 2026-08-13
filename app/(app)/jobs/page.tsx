import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit, canSeeFinancials, isAdmin, type JobView } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import { formatAED, formatPercent } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { CapNotice } from "@/components/layout/cap-notice";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { DeleteJobButton } from "@/components/jobs/delete-job-button";
import { JobsFilterBar } from "@/components/jobs/jobs-filter-bar";
import { NewJobDialog } from "@/components/jobs/new-job-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const monthOf = (j: JobView) => (j.start_date ?? j.created_at ?? "").slice(0, 7);

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { status?: string; site?: string; month?: string; q?: string };
}) {
  const profile = await getProfile();
  const showMoney = canSeeFinancials(profile.role_tier);
  const canDelete = isAdmin(profile.role_tier);
  const supabase = createClient();

  // Exact count alongside the capped page, so a truncated list can say so.
  let query = supabase
    .from("jobs_view")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(2000);

  if (searchParams.status) query = query.eq("status", searchParams.status);
  if (searchParams.site) query = query.eq("site_id", searchParams.site);
  if (searchParams.q) {
    const term = searchParams.q.replace(/[%,]/g, " ").trim();
    if (term) query = query.or(`job_code.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, count } = await query;
  // Before the client-side month filter narrows it further — the notice is
  // about what the query fetched, not about what the filter kept.
  const fetched = (data ?? []).length;
  let jobs = (data ?? []) as JobView[];
  if (searchParams.month) jobs = jobs.filter((j) => monthOf(j) === searchParams.month);

  const [{ data: sites }, { data: projects }] = await Promise.all([
    supabase.from("sites").select("id, code, name").eq("active", true).order("code"),
    supabase.from("projects_view").select("id, project_code, name").order("project_code"),
  ]);
  const projectOptions = (projects ?? []).map((p) => ({
    value: p.id as string,
    label: `${p.project_code} — ${p.name}`,
  }));

  return (
    <div>
      <PageHeader title="Jobs Register" description={`${jobs.length} job(s)`}>
        {canEdit(profile.role_tier) && (
          <NewJobDialog sites={sites ?? []} projects={projectOptions} />
        )}
      </PageHeader>

      <JobsFilterBar sites={sites ?? []} />

      <div className="space-y-3 p-6">
        <CapNotice shown={fetched} total={count} />
        <div className="border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Code</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Completion</TableHead>
                {showMoney && <TableHead>Final Quote</TableHead>}
                {showMoney && <TableHead>Actual Cost</TableHead>}
                {showMoney && <TableHead>P/L %</TableHead>}
                {canDelete && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={(showMoney ? 9 : 6) + (canDelete ? 1 : 0)}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No jobs match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {jobs.map((j) => (
                <TableRow key={j.id ?? ""} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/jobs/${j.id}/worksheet`}
                      className="code-chip text-steel hover:underline"
                    >
                      {j.job_code}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs" title={j.site_name ?? ""}>
                    {j.site_code}
                  </TableCell>
                  <TableCell className="text-left max-w-[22rem] truncate text-xs">
                    {j.description}
                  </TableCell>
                  <TableCell>
                    <JobStatusBadge status={j.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDate(j.start_date)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDate(j.completion_date)}
                  </TableCell>
                  {showMoney && (
                    <TableCell className="text-right tabular text-xs">
                      {formatAED(j.final_quote)}
                    </TableCell>
                  )}
                  {showMoney && (
                    <TableCell className="text-right tabular text-xs">
                      {formatAED(j.actual_cost)}
                    </TableCell>
                  )}
                  {showMoney && (
                    <TableCell
                      className={`text-right tabular text-xs ${
                        (j.pl_percentage ?? 0) >= 0 ? "text-status-com" : "text-destructive"
                      }`}
                    >
                      {formatPercent(j.pl_percentage)}
                    </TableCell>
                  )}
                  {canDelete && (
                    <TableCell>
                      <DeleteJobButton jobId={j.id ?? ""} jobCode={j.job_code} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

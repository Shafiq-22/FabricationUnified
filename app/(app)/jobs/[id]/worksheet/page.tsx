import Link from "next/link";
import { notFound } from "next/navigation";
import { Ruler, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { canSeeFinancials, type JobView } from "@/lib/types";
import { fmtDate, daysBetween } from "@/lib/date";
import { PageHeader } from "@/components/layout/page-header";
import { JobStatusControl } from "@/components/jobs/job-status-control";
import { WorksheetPanels } from "@/components/jobs/worksheet-panels";
import { JobMetaForm } from "@/components/jobs/job-meta-form";
import { CommentsThread } from "@/components/jobs/comments-thread";
import { QuotationPdfButton } from "@/components/pdf/quotation-pdf-button";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function WorksheetPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await getProfile();
  const editable = profile.role_tier >= 2;
  const showMoney = canSeeFinancials(profile.role_tier);
  const supabase = createClient();

  const { data: jobRow } = await supabase
    .from("jobs_view")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!jobRow) notFound();
  const job = jobRow as JobView;

  // Worksheet detail tables are Tier 2+; skip the queries for Viewers.
  let qm: any[] = [], qw: any[] = [], qs: any[] = [], am: any[] = [], aw: any[] = [], asum: any[] = [];
  if (showMoney) {
    const [qmR, qwR, qsR, amR, awR, asR] = await Promise.all([
      supabase.from("job_quote_materials").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("job_quote_workforce").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("job_quotation_summary").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("job_actual_materials").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("job_actual_workforce").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("job_actual_summary").select("*").eq("job_id", params.id).order("seq_no"),
    ]);
    qm = qmR.data ?? []; qw = qwR.data ?? []; qs = qsR.data ?? [];
    am = amR.data ?? []; aw = awR.data ?? []; asum = asR.data ?? [];
  }

  const { data: comments } = await supabase
    .from("job_comments")
    .select("*")
    .eq("job_id", params.id)
    .order("created_at", { ascending: true });

  const { data: users } = await supabase.from("users").select("id, full_name");
  const authorNames = Object.fromEntries((users ?? []).map((u) => [u.id, u.full_name]));

  const config = await getAppConfig();
  const quoteToJob = daysBetween(job.created_at, job.start_date);
  const startToEnd = daysBetween(job.start_date, job.completion_date);

  return (
    <div className="pb-10">
      <PageHeader title={job.job_code ?? "Job"} description={job.description ?? undefined}>
        <Button asChild variant="ghost" size="sm">
          <Link href="/jobs">
            <ArrowLeft className="h-4 w-4" /> Jobs
          </Link>
        </Button>
        <JobStatusControl jobId={params.id} status={job.status ?? "quotation"} editable={editable} />
        <Button asChild variant="outline" size="sm">
          <Link href={`/jobs/${params.id}/roughsheet`}>
            <Ruler className="h-4 w-4" /> Rough Sheet
          </Link>
        </Button>
        {showMoney && (
          <QuotationPdfButton
            data={{
              companyName: config.companyName,
              departmentName: config.departmentName,
              job: {
                job_code: job.job_code,
                site_code: job.site_code,
                site_name: job.site_name,
                description: job.description,
                start_date: job.start_date,
                qty: job.qty,
                unit: job.unit,
              },
              materials: qm.map((m) => ({
                material_name: m.material_name, unit: m.unit, qty: m.qty,
                unit_cost: m.unit_cost, total_cost: m.total_cost,
              })),
              workforce: qw.map((w) => ({
                designation: w.designation, qty: w.qty,
                hrs_per_person: w.hrs_per_person, total_hours: w.total_hours,
              })),
              summary: qs.map((it) => ({
                item_name: it.item_name, unit: it.unit, qty: it.qty,
                unit_cost: it.unit_cost, total_cost: it.total_cost,
              })),
              marginPct: (job.margin ?? 0) * 100,
              finalQuote: job.final_quote ?? 0,
            }}
          />
        )}
      </PageHeader>

      {/* Job summary strip */}
      <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-border bg-card px-6 py-3 text-xs">
        <Meta label="Site" value={`${job.site_code ?? "—"} · ${job.site_name ?? ""}`} />
        <Meta label="Qty" value={job.qty != null ? `${job.qty} ${job.unit ?? ""}` : "—"} />
        <Meta label="Start" value={fmtDate(job.start_date)} />
        <Meta label="Completion" value={fmtDate(job.completion_date)} />
        <Meta label="Quote→Job" value={quoteToJob != null ? `${quoteToJob} d` : "—"} />
        <Meta label="Start→End" value={startToEnd != null ? `${startToEnd} d` : "—"} />
      </div>

      {showMoney ? (
        <WorksheetPanels
          job={job}
          editable={editable}
          quoteMaterials={qm}
          quoteWorkforce={qw}
          quotationSummary={qs}
          actualMaterials={am}
          actualWorkforce={aw}
          actualSummary={asum}
        />
      ) : (
        <div className="m-6 border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Worksheet financials and material/workforce detail are restricted for
          your role. You can view job status and add comments below.
        </div>
      )}

      <div className="space-y-4 px-6">
        <JobMetaForm job={job} editable={editable} />
        <CommentsThread jobId={params.id} initial={comments ?? []} authorNames={authorNames} />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

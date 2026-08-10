import Link from "next/link";
import { notFound } from "next/navigation";
import { Ruler, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSeeFinancials, type JobView } from "@/lib/types";
import { fmtDate, daysBetween } from "@/lib/date";
import { formatAED, formatPercent } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { JobStatusControl } from "@/components/jobs/job-status-control";
import { WorksheetPanels } from "@/components/jobs/worksheet-panels";
import { JobMetaForm } from "@/components/jobs/job-meta-form";
import { CommentsThread } from "@/components/jobs/comments-thread";
import { QuotationPdfButton } from "@/components/pdf/quotation-pdf-button";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentsTable } from "@/components/documents/documents-table";
import { Button } from "@/components/ui/button";
import type { DocumentRow } from "@/lib/types";
import type { HistoricLookup } from "@/components/jobs/tentative-panel";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
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

  // Worksheet detail tables are Tier 2+; skip for Viewers.
  let qm: any[] = [], qw: any[] = [], qc: any[] = [];
  let am: any[] = [], aw: any[] = [], ac: any[] = [];
  let rates: { designation: string; rate: number }[] = [];
  const historic: HistoricLookup = {};
  const margins = { material: 15, workforce: 15, consumables: 15 };
  let companyName = "SIXCO";
  let departmentName = "BAF — Workshop Steel Fabrication";

  const { data: cfgRows } = await supabase.from("app_config").select("key, value");
  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));
  margins.material = Number(cfg.material_margin ?? 15);
  margins.workforce = Number(cfg.workforce_margin ?? 15);
  margins.consumables = Number(cfg.consumables_margin ?? 15);
  companyName = cfg.company_name ?? companyName;
  departmentName = cfg.department_name ?? departmentName;

  if (showMoney) {
    const [qmR, qwR, qcR, amR, awR, acR, rateR, histR] = await Promise.all([
      supabase.from("job_quote_materials").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("job_quote_workforce").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("job_quote_consumables").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("job_actual_materials").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("job_actual_workforce").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("job_actual_consumables").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("labour_rates").select("designation, rate_aed_per_hr").eq("active", true).order("designation"),
      supabase.from("historic_prices").select("item_key, avg_price, last_price"),
    ]);
    qm = qmR.data ?? []; qw = qwR.data ?? []; qc = qcR.data ?? [];
    am = amR.data ?? []; aw = awR.data ?? []; ac = acR.data ?? [];
    rates = (rateR.data ?? []).map((r) => ({ designation: r.designation, rate: Number(r.rate_aed_per_hr) }));
    (histR.data ?? []).forEach((h) => {
      if (h.item_key) historic[h.item_key] = { avg: h.avg_price, last: h.last_price };
    });
  }

  const [{ data: comments }, { data: docs }] = await Promise.all([
    supabase
      .from("job_comments")
      .select("*")
      .eq("job_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select("*")
      .eq("job_id", params.id)
      .order("uploaded_at", { ascending: false }),
  ]);

  const { data: users } = await supabase.from("users").select("id, full_name");
  const authorNames = Object.fromEntries((users ?? []).map((u) => [u.id, u.full_name]));

  const quoteToJob = daysBetween(job.created_at, job.start_date);
  const leadTime = daysBetween(job.start_date, job.completion_date);
  const expectedPL =
    job.final_quote != null && job.quote_before_margin != null
      ? job.final_quote - job.quote_before_margin
      : null;

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
              companyName,
              departmentName,
              job: {
                job_code: job.job_code,
                site_code: job.site_code,
                site_name: job.site_name,
                description: job.description,
                start_date: job.start_date,
                qty: job.qty,
                unit: job.unit,
              },
              quotationRef: job.quotation_ref,
              summary: {
                description: job.description,
                unit: job.unit,
                qty: job.qty,
                unit_cost: job.qty && job.final_quote != null ? job.final_quote / job.qty : null,
                total: job.final_quote ?? 0,
              },
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
        <Meta label="Lead Time" value={leadTime != null ? `${leadTime} d` : "—"} />
        <Meta label="Expected P/L" value={showMoney ? formatAED(expectedPL) : "—"} />
        <Meta label="Total P/L" value={showMoney ? formatAED(job.profit_loss) : "—"} accent />
      </div>

      {showMoney ? (
        <WorksheetPanels
          job={job}
          editable={editable}
          margins={margins}
          rates={rates}
          historic={historic}
          quoteMaterials={qm}
          quoteWorkforce={qw}
          quoteConsumables={qc}
          actualMaterials={am}
          actualWorkforce={aw}
          actualConsumables={ac}
        />
      ) : (
        <div className="m-6 border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Worksheet financials and material/workforce detail are restricted for
          your role. You can view job status and add comments below.
        </div>
      )}

      <div className="space-y-4 px-6">
        <section className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Documents <span className="text-muted-foreground/60">({(docs ?? []).length})</span>
            </h3>
            {editable && (
              <DocumentUpload
                jobOptions={[{ value: params.id, label: job.job_code ?? "This job" }]}
                defaultJobId={params.id}
                label="Upload"
              />
            )}
          </div>
          <DocumentsTable
            rows={(docs ?? []) as DocumentRow[]}
            jobCodes={{ [params.id]: job.job_code ?? "" }}
            jobOptions={[{ value: params.id, label: job.job_code ?? "This job" }]}
            uploaderNames={authorNames}
            canEdit={editable}
            canDelete={profile.role_tier >= 3}
            compact
          />
        </section>
        <JobMetaForm job={job} editable={editable} />
        <CommentsThread jobId={params.id} initial={comments ?? []} authorNames={authorNames} />
      </div>
    </div>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`font-medium ${accent ? "text-steel" : ""}`}>{value}</div>
    </div>
  );
}

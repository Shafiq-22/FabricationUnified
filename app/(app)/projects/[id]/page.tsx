import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSeeFinancials, PROJECT_STATUSES } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAED } from "@/lib/utils";
import { fmtDate } from "@/lib/date";
import { ProjectDetail } from "@/components/projects/project-detail";
import type { ProjectView } from "@/lib/types";
import type { RollupRow, ProjectJob } from "@/components/projects/project-detail";

export const dynamic = "force-dynamic";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const profile = await getProfile();
  const showMoney = canSeeFinancials(profile.role_tier);
  const canEdit = profile.role_tier >= 2;
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects_view")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();
  const p = project as ProjectView;

  // Jobs on this project, plus the ones still free to be attached.
  const [{ data: ownJobs }, { data: freeJobs }] = await Promise.all([
    supabase
      .from("jobs_view")
      .select("id, job_code, description, site_code, status, qty, unit, final_quote, actual_cost, profit_loss, completion_date")
      .eq("project_id", params.id)
      .order("job_code"),
    supabase
      .from("jobs_view")
      .select("id, job_code, description, site_code, status")
      .is("project_id", null)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const jobs = (ownJobs ?? []) as any[];
  const jobIds = jobs.map((j) => j.id as string);
  const jobCodes: Record<string, string> = Object.fromEntries(
    jobs.map((j) => [j.id as string, j.job_code ?? ""]),
  );

  // Roll-ups across every job in the project. Empty project => skip the reads.
  let materials: RollupRow[] = [];
  let consumables: RollupRow[] = [];
  let workforce: RollupRow[] = [];
  let documents: any[] = [];
  let contacts: any[] = [];

  if (jobIds.length > 0) {
    const [{ data: qm }, { data: am }, { data: qc }, { data: ac }, { data: qw }, { data: aw }, { data: docs }, { data: cas }] =
      await Promise.all([
        supabase.from("job_quote_materials").select("*").in("job_id", jobIds),
        supabase.from("job_actual_materials").select("*").in("job_id", jobIds),
        supabase.from("job_quote_consumables").select("*").in("job_id", jobIds),
        supabase.from("job_actual_consumables").select("*").in("job_id", jobIds),
        supabase.from("job_quote_workforce").select("*").in("job_id", jobIds),
        supabase.from("job_actual_workforce").select("*").in("job_id", jobIds),
        supabase
          .from("documents")
          .select("id, title, doc_type, job_id, uploaded_at")
          .eq("project_id", params.id)
          .is("deleted_at", null)
          .order("uploaded_at", { ascending: false }),
        supabase.from("contact_assignments").select("*"),
      ]);

    materials = rollup(qm ?? [], am ?? [], jobCodes, "material_name", (r) => r.dimension ?? r.unit);
    consumables = rollup(qc ?? [], ac ?? [], jobCodes, "item_name", (r) => r.unit);
    workforce = rollupWorkforce(qw ?? [], aw ?? [], jobCodes);
    documents = docs ?? [];

    const relevant = (cas ?? []).filter(
      (a: any) => a.project_id === params.id || (a.job_id && jobIds.includes(a.job_id)),
    );
    if (relevant.length > 0) {
      const { data: people } = await supabase
        .from("contacts")
        .select("id, name, role, organisation, email")
        .in("id", Array.from(new Set(relevant.map((a: any) => a.contact_id))));
      const byId = new Map((people ?? []).map((c: any) => [c.id, c]));
      // One person in one capacity is one entry, however many ways they are
      // attached: assigned to the project and to two of its jobs still reads
      // as a single line listing those jobs.
      const merged = new Map<string, any>();
      for (const a of relevant) {
        const key = `${a.contact_id}:${a.role}`;
        const jobCode = a.job_id ? (jobCodes[a.job_id] ?? null) : null;
        const seen = merged.get(key);
        if (seen) {
          if (jobCode && !seen.jobCodes.includes(jobCode)) seen.jobCodes.push(jobCode);
          if (!a.job_id) seen.onProject = true;
        } else {
          merged.set(key, {
            id: a.id,
            role: a.role,
            jobCodes: jobCode ? [jobCode] : [],
            onProject: !a.job_id,
            contact: byId.get(a.contact_id) ?? null,
          });
        }
      }
      contacts = Array.from(merged.values());
    }
  }

  const statusLabel =
    PROJECT_STATUSES.find((s) => s.value === p.status)?.label ?? p.status ?? "—";
  const statusBadge = (PROJECT_STATUSES.find((s) => s.value === p.status)?.badge ??
    "secondary") as "qtn" | "inp" | "com" | "del" | "hal" | "secondary";

  return (
    <div>
      <PageHeader title={p.name ?? "Project"} description={p.project_code ?? undefined}>
        <Badge variant={statusBadge}>{statusLabel}</Badge>
        <Button variant="outline" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" /> All Projects
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 p-6 pb-0 lg:grid-cols-4">
        <KpiCard
          label="Jobs"
          value={`${p.job_count ?? 0}`}
          hint={`${p.completed_job_count ?? 0} completed or delivered`}
          accent="neutral"
        />
        {showMoney ? (
          <>
            <KpiCard label="Quoted (from jobs)" value={formatAED(p.quoted_value)} accent="neutral" />
            <KpiCard label="Actual (from jobs)" value={formatAED(p.actual_value)} accent="neutral" />
            <KpiCard
              label="Contract Value"
              value={formatAED(p.contract_value)}
              hint="Entered manually"
              accent="neutral"
            />
          </>
        ) : (
          <>
            <KpiCard label="Client" value={p.client_name ?? "—"} accent="neutral" />
            <KpiCard label="Site" value={p.site_code ?? "—"} hint={p.site_name ?? undefined} accent="neutral" />
            <KpiCard label="Target" value={fmtDate(p.target_completion)} accent="neutral" />
          </>
        )}
      </div>

      <ProjectDetail
        projectId={params.id}
        jobs={jobs as ProjectJob[]}
        availableJobs={(freeJobs ?? []) as any[]}
        materials={materials}
        consumables={consumables}
        workforce={workforce}
        documents={documents}
        contacts={contacts}
        meta={{
          client: p.client_name ?? "—",
          site: p.site_code ? `${p.site_code} — ${p.site_name ?? ""}` : "—",
          start: fmtDate(p.start_date),
          target: fmtDate(p.target_completion),
          actual: fmtDate(p.actual_completion),
          notes: p.notes ?? "",
        }}
        showMoney={showMoney}
        canEdit={canEdit}
        canDelete={profile.role_tier >= 3}
      />
    </div>
  );
}

/**
 * Merge a quote table and an actual table into one row per item, so the
 * project shows what was priced against what was really consumed.
 */
function rollup(
  quote: any[],
  actual: any[],
  jobCodes: Record<string, string>,
  nameKey: string,
  detail: (r: any) => string | null,
): RollupRow[] {
  const acc = new Map<string, RollupRow>();
  const add = (rows: any[], side: "quote" | "actual") => {
    for (const r of rows) {
      const name = (r[nameKey] ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const row =
        acc.get(key) ??
        ({
          name,
          detail: detail(r),
          quoteQty: 0,
          quoteCost: 0,
          actualQty: 0,
          actualCost: 0,
          jobs: [],
        } as RollupRow);
      if (side === "quote") {
        row.quoteQty += Number(r.qty ?? 0);
        row.quoteCost += Number(r.total_cost ?? 0);
      } else {
        row.actualQty += Number(r.qty ?? 0);
        row.actualCost += Number(r.total_cost ?? 0);
      }
      const code = jobCodes[r.job_id];
      if (code && !row.jobs.includes(code)) row.jobs.push(code);
      if (!row.detail) row.detail = detail(r);
      acc.set(key, row);
    }
  };
  add(quote, "quote");
  add(actual, "actual");
  return Array.from(acc.values()).sort((a, b) => b.actualCost + b.quoteCost - (a.actualCost + a.quoteCost));
}

/** Workforce rolls up by designation, in hours rather than quantities. */
function rollupWorkforce(
  quote: any[],
  actual: any[],
  jobCodes: Record<string, string>,
): RollupRow[] {
  const acc = new Map<string, RollupRow>();
  const add = (rows: any[], side: "quote" | "actual") => {
    for (const r of rows) {
      const name = (r.designation ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const hours = Number(r.total_hours ?? 0);
      const row =
        acc.get(key) ??
        ({
          name,
          detail: "hours",
          quoteQty: 0,
          quoteCost: 0,
          actualQty: 0,
          actualCost: 0,
          jobs: [],
        } as RollupRow);
      if (side === "quote") {
        row.quoteQty += hours;
        row.quoteCost += hours * Number(r.rate_aed_per_hr ?? 0);
      } else {
        row.actualQty += hours;
        row.actualCost += hours * Number(r.rate_aed_per_hr ?? 0);
      }
      const code = jobCodes[r.job_id];
      if (code && !row.jobs.includes(code)) row.jobs.push(code);
      acc.set(key, row);
    }
  };
  add(quote, "quote");
  add(actual, "actual");
  return Array.from(acc.values()).sort((a, b) => b.actualQty + b.quoteQty - (a.actualQty + a.quoteQty));
}

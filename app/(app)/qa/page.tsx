import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InspectionsManager, NcrsManager } from "@/components/qa/qa-managers";
import type { InspectionReport, Ncr } from "@/lib/types";

export const dynamic = "force-dynamic";

type Tab = "inspections" | "ncrs";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function QaPage({ searchParams }: { searchParams: { tab?: Tab } }) {
  const profile = await getProfile();
  const tab: Tab = searchParams.tab ?? "inspections";
  const canEdit = profile.role_tier >= 2;
  const canDelete = profile.role_tier >= 3;
  const supabase = createClient();

  const [{ data: inspections }, { data: ncrs }, { data: jobs }, { data: personnel }, { data: projects }] =
    await Promise.all([
      supabase.from("inspection_reports").select("*").order("inspected_at", { ascending: false }).limit(1000),
      supabase.from("ncrs").select("*").order("raised_at", { ascending: false }).limit(1000),
      supabase.from("jobs_view").select("id, job_code").order("created_at", { ascending: false }).limit(2000),
      supabase.from("personnel").select("id, name, trade").eq("active", true).order("name"),
      supabase.from("projects_view").select("id, project_code, name").order("project_code"),
    ]);

  const inspectionRows = (inspections ?? []) as InspectionReport[];
  const ncrRows = (ncrs ?? []) as Ncr[];

  const jobOptions = (jobs ?? []).map((j: any) => ({ value: j.id as string, label: j.job_code ?? "" }));
  const jobCodes: Record<string, string> = Object.fromEntries(
    (jobs ?? []).map((j: any) => [j.id as string, j.job_code ?? ""]),
  );
  const inspectorOptions = (personnel ?? []).map((p: any) => ({
    value: p.id as string,
    label: p.trade ? `${p.name} (${p.trade})` : (p.name as string),
  }));
  const inspectorNames: Record<string, string> = Object.fromEntries(
    (personnel ?? []).map((p: any) => [p.id as string, p.name as string]),
  );
  const projectOptions = (projects ?? []).map((p: any) => ({
    value: p.id as string,
    label: `${p.project_code} — ${p.name}`,
  }));

  const openNcrs = ncrRows.filter((n) => n.status !== "closed").length;
  const failed = inspectionRows.filter((i) => i.result === "fail").length;
  const passRate =
    inspectionRows.length > 0
      ? Math.round(
          (inspectionRows.filter((i) => i.result === "pass").length / inspectionRows.length) * 100,
        )
      : null;

  return (
    <div>
      <PageHeader
        title="Quality"
        description="Inspection records and non-conformance reports (ISO 3834-2 traceability)"
      />
      <div className="flex gap-1 border-b border-border bg-card px-6">
        <TabLink current={tab} value="inspections" label="Inspections" />
        <TabLink current={tab} value="ncrs" label="NCRs" />
      </div>

      <div className="grid grid-cols-2 gap-3 p-6 pb-0 sm:grid-cols-4">
        <KpiCard label="Inspections" value={String(inspectionRows.length)} accent="neutral" />
        <KpiCard label="Pass Rate" value={passRate == null ? "—" : `${passRate}%`} accent={passRate != null && passRate >= 90 ? "positive" : "amber"} />
        <KpiCard label="Failed" value={String(failed)} accent={failed > 0 ? "negative" : "positive"} />
        <KpiCard label="Open NCRs" value={String(openNcrs)} accent={openNcrs > 0 ? "negative" : "positive"} />
      </div>

      <div className="p-6">
        {tab === "inspections" ? (
          <InspectionsManager
            rows={inspectionRows}
            jobOptions={jobOptions}
            jobCodes={jobCodes}
            inspectorOptions={inspectorOptions}
            inspectorNames={inspectorNames}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : (
          <NcrsManager
            rows={ncrRows}
            jobOptions={jobOptions}
            jobCodes={jobCodes}
            projectOptions={projectOptions}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}
      </div>
    </div>
  );
}

function TabLink({ current, value, label }: { current: Tab; value: Tab; label: string }) {
  const active = current === value;
  return (
    <Link
      href={`/qa?tab=${value}`}
      className={cn(
        "border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

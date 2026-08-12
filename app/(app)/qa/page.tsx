import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InspectionsManager, NcrsManager } from "@/components/qa/qa-managers";
import { CertificatesManager, type CertificateRow } from "@/components/qa/certificates-manager";
import type { InspectionReport, Ncr } from "@/lib/types";
import { canEdit as canEditTier, isAdmin } from "@/lib/types";

export const dynamic = "force-dynamic";

type Tab = "inspections" | "ncrs" | "certificates";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function QaPage({ searchParams }: { searchParams: { tab?: Tab } }) {
  const profile = await getProfile();
  const tab: Tab = searchParams.tab ?? "inspections";
  const canEdit = canEditTier(profile.role_tier);
  const canDelete = isAdmin(profile.role_tier);
  const supabase = createClient();

  const [
    { data: inspections },
    { data: ncrs },
    { data: jobs },
    { data: personnel },
    { data: projects },
    { data: certificates },
    { data: sites },
    { data: cfgRows },
    { data: certFiles },
  ] = await Promise.all([
      supabase.from("inspection_reports").select("*").is("deleted_at", null).order("inspected_at", { ascending: false }).limit(1000),
      supabase.from("ncrs").select("*").is("deleted_at", null).order("raised_at", { ascending: false }).limit(1000),
      supabase.from("jobs_view").select("id, job_code").order("created_at", { ascending: false }).limit(2000),
      supabase.from("personnel").select("id, name, trade").eq("active", true).order("name"),
      supabase.from("projects_view").select("id, project_code, name").order("project_code"),
      supabase
        .from("welder_certificates")
        .select("*")
        .is("deleted_at", null)
        .order("expires_on", { nullsFirst: false }),
      supabase.from("sites").select("id, code, name").order("code"),
      supabase.from("app_config").select("key, value"),
      // The scans attached to certificates — the same rows the Documents
      // tab lists, read here rather than copied.
      supabase
        .from("documents")
        .select("id, title, original_filename, file_path, doc_type, uploaded_at, welder_certificate_id")
        .not("welder_certificate_id", "is", null)
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false }),
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

  const cfg = Object.fromEntries((cfgRows ?? []).map((r: any) => [r.key, r.value]));
  const warnDays = Number(cfg.cert_expiry_warn_days ?? 60);
  const certRows = (certificates ?? []) as CertificateRow[];
  const filesByCert: Record<string, any[]> = {};
  for (const f of (certFiles ?? []) as any[]) {
    if (!f.welder_certificate_id) continue;
    (filesByCert[f.welder_certificate_id] ??= []).push(f);
  }
  const siteNames: Record<string, string> = Object.fromEntries(
    (sites ?? []).map((s: any) => [s.id as string, s.code as string]),
  );
  const siteOptions = (sites ?? []).map((s: any) => ({
    value: s.id as string,
    label: `${s.code} — ${s.name}`,
  }));
  const expiringCerts = certRows.filter((c) => {
    if (!c.expires_on) return false;
    const left = Math.ceil((new Date(c.expires_on).getTime() - Date.now()) / 86_400_000);
    return left <= warnDays;
  }).length;

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
        <TabLink current={tab} value="certificates" label="Welder Certificates" />
      </div>

      <div className="grid grid-cols-2 gap-3 p-6 pb-0 sm:grid-cols-5">
        <KpiCard label="Inspections" value={String(inspectionRows.length)} accent="neutral" />
        <KpiCard label="Pass Rate" value={passRate == null ? "—" : `${passRate}%`} accent={passRate != null && passRate >= 90 ? "positive" : "amber"} />
        <KpiCard label="Failed" value={String(failed)} accent={failed > 0 ? "negative" : "positive"} />
        <KpiCard label="Open NCRs" value={String(openNcrs)} accent={openNcrs > 0 ? "negative" : "positive"} />
        <KpiCard
          label="Certs Expiring"
          value={String(expiringCerts)}
          hint={`within ${warnDays} days`}
          accent={expiringCerts > 0 ? "amber" : "positive"}
        />
      </div>

      <div className="p-6">
        {tab === "certificates" ? (
          <CertificatesManager
            rows={certRows}
            filesByCert={filesByCert}
            siteNames={siteNames}
            siteOptions={siteOptions}
            personnelOptions={inspectorOptions}
            warnDays={warnDays}
            notifyEmail={cfg.cert_expiry_notify_email ?? ""}
            senderName={profile.full_name}
            companyName={cfg.company_name ?? "Six Construct"}
            departmentName={cfg.department_name ?? "Steel Fabrication"}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : tab === "inspections" ? (
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

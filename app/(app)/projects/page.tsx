import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSeeFinancials } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsManager } from "@/components/projects/projects-manager";
import { RfqsManager } from "@/components/projects/rfqs-manager";
import type { ProjectView, Rfq } from "@/lib/types";

export const dynamic = "force-dynamic";

type Tab = "projects" | "rfqs";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { tab?: Tab };
}) {
  const profile = await getProfile();
  const tab: Tab = searchParams.tab ?? "projects";
  const showMoney = canSeeFinancials(profile.role_tier);
  const canEdit = profile.role_tier >= 2;
  const canDelete = profile.role_tier >= 3;
  const supabase = createClient();

  const [{ data: projects }, { data: clients }, { data: sites }, { data: jobs }] =
    await Promise.all([
      supabase.from("projects_view").select("*").order("project_code", { ascending: false }),
      supabase.from("clients").select("id, name, active").order("name"),
      supabase.from("sites").select("id, code, name").eq("active", true).order("code"),
      supabase
        .from("jobs_view")
        .select("id, job_code")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

  const projectRows = (projects ?? []) as ProjectView[];
  const clientOptions = (clients ?? [])
    .filter((c: any) => c.active)
    .map((c: any) => ({ value: c.id as string, label: c.name as string }));
  const siteOptions = (sites ?? []).map((s: any) => ({
    value: s.id as string,
    label: `${s.code} — ${s.name}`,
  }));
  const jobOptions = (jobs ?? []).map((j: any) => ({
    value: j.id as string,
    label: j.job_code ?? "",
  }));
  const clientNames: Record<string, string> = Object.fromEntries(
    (clients ?? []).map((c: any) => [c.id as string, c.name as string]),
  );
  const projectCodes: Record<string, string> = Object.fromEntries(
    projectRows.map((p) => [p.id ?? "", p.project_code ?? ""]),
  );
  const projectOptions = projectRows.map((p) => ({
    value: p.id ?? "",
    label: `${p.project_code} — ${p.name}`,
  }));

  let rfqs: Rfq[] = [];
  if (tab === "rfqs") {
    const { data } = await supabase
      .from("rfqs")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false });
    rfqs = (data ?? []) as Rfq[];
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Client projects and the enquiries that feed them"
      />
      <div className="flex gap-1 border-b border-border bg-card px-6">
        <TabLink current={tab} value="projects" label="Projects" />
        <TabLink current={tab} value="rfqs" label="RFQs" />
      </div>
      <div className="p-6">
        {tab === "projects" ? (
          <ProjectsManager
            rows={projectRows}
            clientOptions={clientOptions}
            siteOptions={siteOptions}
            showMoney={showMoney}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : (
          <RfqsManager
            rows={rfqs}
            clientOptions={clientOptions}
            projectOptions={projectOptions}
            jobOptions={jobOptions}
            clientNames={clientNames}
            projectCodes={projectCodes}
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
      href={`/projects?tab=${value}`}
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

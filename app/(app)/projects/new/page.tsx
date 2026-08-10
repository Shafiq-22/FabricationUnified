import { createClient } from "@/lib/supabase/server";
import { requireTier } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectForm, type SelectableJob } from "@/components/projects/project-form";

export const dynamic = "force-dynamic";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function NewProjectPage() {
  await requireTier(2);
  const supabase = createClient();

  const [{ data: sites }, { data: jobs }] = await Promise.all([
    supabase.from("sites").select("id, code, name").eq("active", true).order("code"),
    // A job belongs to at most one project, so only unclaimed jobs are offered.
    supabase
      .from("jobs_view")
      .select("id, job_code, description, site_code, status")
      .is("project_id", null)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  return (
    <div>
      <PageHeader
        title="New Project"
        description="Group existing jobs under one project — its quoted and actual values are summed from them."
      />
      <ProjectForm
        siteOptions={(sites ?? []).map((s: any) => ({
          value: s.id as string,
          label: `${s.code} — ${s.name}`,
        }))}
        availableJobs={(jobs ?? []).map((j: any) => ({
          id: j.id,
          job_code: j.job_code ?? "",
          description: j.description,
          site_code: j.site_code,
          status: j.status,
        })) as SelectableJob[]}
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit as canEditTier, canSeeFinancials, isAdmin } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsManager } from "@/components/projects/projects-manager";
import type { ProjectView } from "@/lib/types";

export const dynamic = "force-dynamic";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function ProjectsPage() {
  const profile = await getProfile();
  const showMoney = canSeeFinancials(profile.role_tier);
  const canEdit = canEditTier(profile.role_tier);
  const canDelete = isAdmin(profile.role_tier);
  const supabase = createClient();

  const [{ data: projects }, { data: clients }, { data: sites }] = await Promise.all([
    supabase.from("projects_view").select("*").order("project_code", { ascending: false }),
    supabase.from("clients").select("id, name, active").order("name"),
    supabase.from("sites").select("id, code, name").eq("active", true).order("code"),
  ]);

  const projectRows = (projects ?? []) as ProjectView[];
  const clientOptions = (clients ?? [])
    .filter((c: any) => c.active)
    .map((c: any) => ({ value: c.id as string, label: c.name as string }));
  const siteOptions = (sites ?? []).map((s: any) => ({
    value: s.id as string,
    label: `${s.code} — ${s.name}`,
  }));

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Every project and the jobs that make it up. Quoted and actual values are summed from those jobs."
      />
      <div className="p-6">
        <ProjectsManager
          rows={projectRows}
          clientOptions={clientOptions}
          siteOptions={siteOptions}
          showMoney={showMoney}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>
    </div>
  );
}

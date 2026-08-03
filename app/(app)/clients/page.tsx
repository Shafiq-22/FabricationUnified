import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ClientsManager } from "@/components/projects/clients-manager";
import type { Client } from "@/lib/types";

export const dynamic = "force-dynamic";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function ClientsPage() {
  const profile = await getProfile();
  const supabase = createClient();

  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("projects_view").select("client_id"),
  ]);

  const rows = (clients ?? []) as Client[];
  const projectCounts: Record<string, number> = {};
  (projects ?? []).forEach((p: any) => {
    if (p.client_id) projectCounts[p.client_id] = (projectCounts[p.client_id] ?? 0) + 1;
  });

  return (
    <div>
      <PageHeader title="Clients" description={`${rows.length} client(s)`} />
      <div className="p-6">
        <ClientsManager
          rows={rows}
          projectCounts={projectCounts}
          canEdit={profile.role_tier >= 2}
          canDelete={profile.role_tier >= 3}
        />
      </div>
    </div>
  );
}

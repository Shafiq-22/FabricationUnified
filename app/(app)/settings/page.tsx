import { createClient } from "@/lib/supabase/server";
import { requireTier } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsClient } from "@/components/settings/settings-client";
import type { RoleConfig, LabourRate } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireTier(3);
  const supabase = createClient();

  const [{ data: roles }, { data: rates }, config] = await Promise.all([
    supabase.from("roles_config").select("*").order("tier"),
    supabase.from("labour_rates").select("*").order("designation"),
    getAppConfig(),
  ]);

  return (
    <div>
      <PageHeader title="Settings" description="Roles, labour rates and PDF header configuration" />
      <div className="p-6">
        <SettingsClient
          roles={(roles ?? []) as RoleConfig[]}
          rates={(rates ?? []) as LabourRate[]}
          company={config.companyName}
          department={config.departmentName}
        />
      </div>
    </div>
  );
}

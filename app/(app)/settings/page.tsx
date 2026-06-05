import { createClient } from "@/lib/supabase/server";
import { requireTier } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsClient } from "@/components/settings/settings-client";
import type { RoleConfig, LabourRate } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireTier(3);
  const supabase = createClient();

  const [{ data: roles }, { data: rates }, { data: cfgRows }] = await Promise.all([
    supabase.from("roles_config").select("*").order("tier"),
    supabase.from("labour_rates").select("*").order("designation"),
    supabase.from("app_config").select("key, value"),
  ]);

  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));

  return (
    <div>
      <PageHeader title="Settings" description="Roles, margins, labour rates, PDF header & password" />
      <div className="p-6">
        <SettingsClient
          roles={(roles ?? []) as RoleConfig[]}
          rates={(rates ?? []) as LabourRate[]}
          company={cfg.company_name ?? "Six Construct"}
          department={cfg.department_name ?? "BAF — Steel Fabrication"}
          margins={{
            material: Number(cfg.material_margin ?? 15),
            workforce: Number(cfg.workforce_margin ?? 15),
            consumables: Number(cfg.consumables_margin ?? 15),
          }}
        />
      </div>
    </div>
  );
}

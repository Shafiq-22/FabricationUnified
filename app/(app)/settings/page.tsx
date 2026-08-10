import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTier, getRoleNames } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsClient } from "@/components/settings/settings-client";
import { UsersManager } from "@/components/users/users-manager";
import type { RoleConfig, LabourRate, UserProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

type Tab = "general" | "users";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: Tab };
}) {
  const profile = await requireTier(3);
  const tab: Tab = searchParams.tab ?? "general";
  const supabase = createClient();

  const [{ data: roles }, { data: rates }, { data: cfgRows }] = await Promise.all([
    supabase.from("roles_config").select("*").order("tier"),
    supabase.from("labour_rates").select("*").order("designation"),
    supabase.from("app_config").select("key, value"),
  ]);

  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));

  let users: UserProfile[] = [];
  let roleNames: Record<number, string> = {};
  if (tab === "users") {
    const { data } = await supabase.from("users").select("*").order("full_name");
    users = (data ?? []) as UserProfile[];
    roleNames = await getRoleNames();
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Roles, margins, rates, PDF header, password and user accounts"
      />
      <div className="flex gap-1 border-b border-border bg-card px-6">
        <TabLink current={tab} value="general" label="General" />
        <TabLink current={tab} value="users" label="Users" />
      </div>

      <div className="p-6">
        {tab === "users" ? (
          <UsersManager users={users} roleNames={roleNames} currentUserId={profile.id} />
        ) : (
          <SettingsClient
            roles={(roles ?? []) as RoleConfig[]}
            rates={(rates ?? []) as LabourRate[]}
            company={cfg.company_name ?? "Six Construct"}
            department={cfg.department_name ?? "Steel Fabrication"}
            margins={{
              material: Number(cfg.material_margin ?? 15),
              workforce: Number(cfg.workforce_margin ?? 15),
              consumables: Number(cfg.consumables_margin ?? 15),
            }}
            timesheetRates={{
              normal: Number(cfg.timesheet_normal_rate ?? 30),
              ot: Number(cfg.timesheet_ot_rate ?? 45),
            }}
            inflationPct={Number(cfg.inflation_rate_pct ?? 10)}
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
      href={`/settings?tab=${value}`}
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

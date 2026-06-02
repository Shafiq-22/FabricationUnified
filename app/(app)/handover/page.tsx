import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { HandoverManager } from "@/components/handover/handover-manager";
import type { HandoverItem, Drawing } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HandoverPage() {
  const profile = await getProfile();
  const supabase = createClient();

  const { data: items } = await supabase
    .from("handover_items")
    .select("*")
    .order("created_at", { ascending: false });
  const all = (items ?? []) as HandoverItem[];
  const active = all.filter((i) => i.type === "active");
  const forecasted = all.filter((i) => i.type === "forecasted");

  const { data: drawings } = await supabase
    .from("drawings")
    .select("*")
    .order("created_at", { ascending: true });
  const drawingsByHandover: Record<string, Drawing[]> = {};
  (drawings ?? []).forEach((d) => {
    if (!d.handover_id) return;
    (drawingsByHandover[d.handover_id] ??= []).push(d as Drawing);
  });

  const { data: sites } = await supabase
    .from("sites")
    .select("id, code, name")
    .eq("active", true)
    .order("code");
  const siteOptions = (sites ?? []).map((s) => ({
    value: s.id,
    label: `${s.code} — ${s.name}`,
  }));

  return (
    <div>
      <PageHeader
        title="Handover & Forecast"
        description="Active job handovers with drawings tracking, and forecasted jobs"
      />
      <div className="p-6">
        <HandoverManager
          active={active}
          forecasted={forecasted}
          drawingsByHandover={drawingsByHandover}
          siteOptions={siteOptions}
          editable={profile.role_tier >= 2}
          canDelete={profile.role_tier >= 3}
        />
      </div>
    </div>
  );
}

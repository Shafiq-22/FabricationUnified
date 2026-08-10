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

  const [{ data: sites }, { data: contacts }, { data: cfgRows }, { data: jobs }] =
    await Promise.all([
    supabase.from("sites").select("id, code, name").eq("active", true).order("code"),
    // The site's point of contact addresses the transfer notice.
    supabase
      .from("contacts")
      .select("site_id, email, role")
      .eq("active", true)
      .not("email", "is", null)
      .not("site_id", "is", null),
    supabase.from("app_config").select("key, value"),
    supabase
      .from("jobs_view")
      .select("id, job_code, description")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  const siteOptions = (sites ?? []).map((s) => ({
    value: s.id,
    label: `${s.code} — ${s.name}`,
  }));
  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));
  const jobOptions = (jobs ?? []).map((j) => ({
    value: j.id as string,
    label: j.description ? `${j.job_code} — ${j.description}` : (j.job_code ?? ""),
  }));
  const jobCodes: Record<string, string> = Object.fromEntries(
    (jobs ?? []).map((j) => [j.id as string, j.job_code ?? ""]),
  );

  // A site in-charge wins over any other contact at that site.
  const siteContactEmails: Record<string, string> = {};
  for (const c of contacts ?? []) {
    if (!c.site_id || !c.email) continue;
    if (!siteContactEmails[c.site_id] || c.role === "project_incharge") {
      siteContactEmails[c.site_id] = c.email;
    }
  }

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
          jobOptions={jobOptions}
          jobCodes={jobCodes}
          siteContactEmails={siteContactEmails}
          senderName={profile.full_name}
          companyName={cfg.company_name ?? "Six Construct"}
          departmentName={cfg.department_name ?? "Steel Fabrication"}
          editable={profile.role_tier >= 2}
          canDelete={profile.role_tier >= 3}
        />
      </div>
    </div>
  );
}

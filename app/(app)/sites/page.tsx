import { createClient } from "@/lib/supabase/server";
import { requireAccess } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { SitesManager, type SiteContact } from "@/components/sites/sites-manager";
import type { Site } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  await requireAccess("admin");
  const supabase = createClient();
  const [{ data }, { data: contacts }] = await Promise.all([
    supabase.from("sites").select("*").order("code"),
    supabase
      .from("contacts")
      .select("id, name, role, site_id")
      .eq("active", true)
      .not("site_id", "is", null)
      .order("name"),
  ]);
  const sites = (data ?? []) as Site[];

  // Every point of contact is linked to a site, so the Sites tab shows who
  // to call for each one.
  const contactsBySite: Record<string, SiteContact[]> = {};
  for (const c of (contacts ?? []) as SiteContact[]) {
    if (!c.site_id) continue;
    (contactsBySite[c.site_id] ??= []).push(c);
  }

  return (
    <div>
      <PageHeader title="Sites" description={`${sites.length} site code(s)`} />
      <div className="p-6">
        <SitesManager sites={sites} contactsBySite={contactsBySite} />
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { requireTier } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { SitesManager } from "@/components/sites/sites-manager";
import type { Site } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  await requireTier(3);
  const supabase = createClient();
  const { data } = await supabase.from("sites").select("*").order("code");
  const sites = (data ?? []) as Site[];

  return (
    <div>
      <PageHeader title="Sites" description={`${sites.length} site code(s)`} />
      <div className="p-6">
        <SitesManager sites={sites} />
      </div>
    </div>
  );
}

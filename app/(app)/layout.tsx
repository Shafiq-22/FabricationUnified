import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  // The bell's opening state. RLS limits this to the signed-in user's rows.
  const supabase = createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, kind, job_id, title, body, href, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <Providers profile={profile}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar tier={profile.role_tier} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar notifications={notifications ?? []} />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </Providers>
  );
}

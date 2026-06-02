import { getProfile } from "@/lib/auth";
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

  return (
    <Providers profile={profile}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar tier={profile.role_tier} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </Providers>
  );
}

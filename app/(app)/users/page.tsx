import { createClient } from "@/lib/supabase/server";
import { requireTier, getRoleNames } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { UsersManager } from "@/components/users/users-manager";
import type { UserProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const profile = await requireTier(3);
  const supabase = createClient();

  const { data } = await supabase
    .from("users")
    .select("*")
    .order("full_name");
  const users = (data ?? []) as UserProfile[];
  const roleNames = await getRoleNames();

  return (
    <div>
      <PageHeader title="User Management" description={`${users.length} user(s)`} />
      <div className="p-6">
        <UsersManager users={users} roleNames={roleNames} currentUserId={profile.id} />
      </div>
    </div>
  );
}

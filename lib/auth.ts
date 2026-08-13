import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { hasAccess, type AccessLevel, type SessionProfile, type Tier } from "@/lib/types";

/**
 * Resolve the signed-in user's profile (with role display name). Redirects to
 * /login when there is no session, and signs out + redirects when the profile
 * is missing or deactivated. Cached per request via React.cache.
 */
export const getProfile = cache(async (): Promise<SessionProfile> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, full_name, email, role_tier, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    redirect("/login?reason=inactive");
  }

  const { data: role } = await supabase
    .from("roles_config")
    .select("display_name")
    .eq("tier", profile.role_tier)
    .maybeSingle();

  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    role_tier: profile.role_tier as Tier,
    active: profile.active,
    role_name: role?.display_name ?? `Tier ${profile.role_tier}`,
  };
});

/**
 * Gate a page on a named access level; redirect to /dashboard otherwise.
 *
 * This replaced the old `requireTier(min)`, which compared tier numbers with
 * `<`. Since 0049 the numbers are not ordinal — tier 1 is an administrator —
 * so that comparison locked the most privileged role out of Settings, Sites,
 * Procurement, Personnel & Equipment and project creation.
 */
export async function requireAccess(level: AccessLevel): Promise<SessionProfile> {
  const profile = await getProfile();
  if (!hasAccess(profile.role_tier, level)) redirect("/dashboard");
  return profile;
}

/** Map of tier -> display name (for rendering role labels anywhere). */
export const getRoleNames = cache(async (): Promise<Record<number, string>> => {
  const supabase = createClient();
  const { data } = await supabase.from("roles_config").select("tier, display_name");
  const map: Record<number, string> = {};
  (data ?? []).forEach((r) => (map[r.tier] = r.display_name));
  return map;
});

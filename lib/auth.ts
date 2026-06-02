import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SessionProfile, Tier } from "@/lib/types";

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

/** Require a minimum tier for a page; redirect to /dashboard otherwise. */
export async function requireTier(min: Tier): Promise<SessionProfile> {
  const profile = await getProfile();
  if (profile.role_tier < min) redirect("/dashboard");
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

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

const schema = z.object({
  code: z.string().trim().min(1, "Code is required").max(8, "Code too long"),
  name: z.string().trim().min(1, "Name is required"),
  location: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
});

async function requireAdmin() {
  const profile = await getProfile();
  if (profile.role_tier < 3) throw new Error("Only administrators may manage sites.");
}

export async function createSite(values: Record<string, string>) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("sites").insert({
    code: parsed.data.code.toUpperCase(),
    name: parsed.data.name,
    location: parsed.data.location ?? null,
  });
  if (error)
    return {
      error: error.code === "23505" ? "A site with this code already exists." : error.message,
    };
  revalidatePath("/sites");
  return { error: null };
}

export async function updateSite(id: string, values: Record<string, string>) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase
    .from("sites")
    .update({
      code: parsed.data.code.toUpperCase(),
      name: parsed.data.name,
      location: parsed.data.location ?? null,
    })
    .eq("id", id);
  if (error)
    return {
      error: error.code === "23505" ? "A site with this code already exists." : error.message,
    };
  revalidatePath("/sites");
  return { error: null };
}

export async function toggleSiteActive(id: string, active: boolean) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();
  const { error } = await supabase.from("sites").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/sites");
  return { error: null };
}

/**
 * Remove a site. Job codes embed the site code, so a site that any job still
 * points at is refused — deactivating hides it from the pickers without
 * orphaning those codes.
 */
export async function deleteSite(id: string) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();

  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("site_id", id);
  if (count && count > 0)
    return {
      error: `${count} job${count === 1 ? "" : "s"} still reference this site — deactivate it instead so existing job codes keep their meaning.`,
    };

  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "This site is referenced by existing records — deactivate it instead."
          : error.message,
    };
  }
  revalidatePath("/sites");
  return { error: null };
}

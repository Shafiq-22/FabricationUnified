"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

async function requireAdmin() {
  const profile = await getProfile();
  if (profile.role_tier < 3) throw new Error("Only administrators may change settings.");
}

export async function updateRoleName(tier: number, displayName: string) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const name = displayName.trim();
  if (!name) return { error: "Display name cannot be empty." };
  const supabase = createClient();
  const { error } = await supabase
    .from("roles_config")
    .update({ display_name: name })
    .eq("tier", tier);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { error: null };
}

export async function updateCompanyConfig(companyName: string, departmentName: string) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();
  const { error } = await supabase.from("app_config").upsert(
    [
      { key: "company_name", value: companyName.trim() },
      { key: "department_name", value: departmentName.trim() },
    ],
    { onConflict: "key" },
  );
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

const marginsSchema = z.object({
  material_margin: z.coerce.number().min(0).max(1000),
  workforce_margin: z.coerce.number().min(0).max(1000),
  consumables_margin: z.coerce.number().min(0).max(1000),
});

export async function updateMargins(values: Record<string, string>) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = marginsSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("app_config").upsert(
    [
      { key: "material_margin", value: String(parsed.data.material_margin) },
      { key: "workforce_margin", value: String(parsed.data.workforce_margin) },
      { key: "consumables_margin", value: String(parsed.data.consumables_margin) },
    ],
    { onConflict: "key" },
  );
  if (error) return { error: error.message };
  // Re-derive every job's quote/final/P&L with the new margins.
  await supabase.rpc("recompute_all_jobs");
  revalidatePath("/settings");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function changeMyPassword(newPassword: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if ((newPassword ?? "").length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { error: null };
}

const rateSchema = z.object({
  designation: z.string().trim().min(1, "Designation is required"),
  rate_aed_per_hr: z.coerce.number().nonnegative("Rate must be ≥ 0"),
});

export async function addLabourRate(values: Record<string, string>) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = rateSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("labour_rates").insert({
    designation: parsed.data.designation,
    rate_aed_per_hr: parsed.data.rate_aed_per_hr,
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

export async function updateLabourRate(id: string, values: Record<string, string>) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = rateSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase
    .from("labour_rates")
    .update({
      designation: parsed.data.designation,
      rate_aed_per_hr: parsed.data.rate_aed_per_hr,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

export async function toggleLabourRate(id: string, active: boolean) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();
  const { error } = await supabase.from("labour_rates").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

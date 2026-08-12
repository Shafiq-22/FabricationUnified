"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit, isAdmin } from "@/lib/types";

const optStr = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: optStr,
  contact_name: optStr,
  contact_email: optStr,
  contact_phone: optStr,
});

function payload(v: z.infer<typeof schema>) {
  return {
    name: v.name.trim(),
    category: v.category ?? null,
    contact_name: v.contact_name ?? null,
    contact_email: v.contact_email ?? null,
    contact_phone: v.contact_phone ?? null,
  };
}

const DUP = "A supplier with this name already exists.";

export async function createSupplier(values: Record<string, string>) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  const { error } = await supabase
    .from("suppliers")
    .insert({ ...payload(parsed.data), created_by: profile.id });
  if (error) return { error: error.code === "23505" ? DUP : error.message };

  revalidatePath("/procurement");
  return { error: null };
}

export async function updateSupplier(id: string, values: Record<string, string>) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  const { error } = await supabase.from("suppliers").update(payload(parsed.data)).eq("id", id);
  if (error) return { error: error.code === "23505" ? DUP : error.message };

  // Keep the denormalised free-text supplier columns in sync with the rename.
  await supabase.from("job_materials").update({ supplier: parsed.data.name.trim() }).eq("supplier_id", id);
  await supabase.from("consumables").update({ supplier: parsed.data.name.trim() }).eq("supplier_id", id);

  revalidatePath("/procurement");
  return { error: null };
}

export async function toggleSupplier(id: string, active: boolean) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const supabase = createClient();
  const { error } = await supabase.from("suppliers").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/procurement");
  return { error: null };
}

export async function deleteSupplier(id: string) {
  const profile = await getProfile();
  if (!isAdmin(profile.role_tier)) return { error: "Only administrators may delete suppliers." };
  const supabase = createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "This supplier is referenced by existing records — deactivate it instead."
          : error.message,
    };
  }
  revalidatePath("/procurement");
  return { error: null };
}

/**
 * Resolve a supplier id to its name so callers can keep writing the legacy
 * free-text `supplier` column alongside the new FK.
 */
export async function supplierNameFor(id: string | null | undefined): Promise<string | null> {
  if (!id || id === "none") return null;
  const supabase = createClient();
  const { data } = await supabase.from("suppliers").select("name").eq("id", id).maybeSingle();
  return data?.name ?? null;
}

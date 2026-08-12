"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/types";

async function requireAdmin() {
  const profile = await getProfile();
  if (!isAdmin(profile.role_tier)) throw new Error("Only administrators may manage users.");
}

const inviteSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Valid email required"),
  password: z.string().min(8, "Temporary password must be at least 8 characters"),
  tier: z.coerce.number().int().min(1).max(3),
});

export async function inviteUser(values: Record<string, string>) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  const { error } = await supabase.rpc("admin_create_user", {
    p_email: parsed.data.email,
    p_full_name: parsed.data.full_name,
    p_password: parsed.data.password,
    p_tier: parsed.data.tier,
  });
  if (error) return { error: error.message };
  revalidatePath("/users");
  return { error: null };
}

export async function setUserTier(id: string, tier: number) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();
  const { error } = await supabase.from("users").update({ role_tier: tier }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/users");
  return { error: null };
}

export async function setUserActive(id: string, active: boolean) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();
  const { error } = await supabase.from("users").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/users");
  return { error: null };
}

export async function resetUserPassword(values: Record<string, string>) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const id = values.user_id;
  const password = values.password ?? "";
  if (!id) return { error: "Missing user." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_reset_password", {
    p_user_id: id,
    p_password: password,
  });
  if (error) return { error: error.message };
  return { error: null };
}

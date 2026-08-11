"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

const blank = (v: unknown) => (v === "" || v === "none" || v == null ? undefined : v);
const optStr = z.preprocess(blank, z.string().optional());

const STATUSES = ["requested", "approved", "completed", "rejected", "cancelled"] as const;

const schema = z.object({
  personnel_id: z.string().uuid("Choose who is being transferred"),
  from_site_id: z.preprocess(blank, z.string().uuid().optional()),
  to_site_id: z.preprocess(blank, z.string().uuid().optional()),
  requested_on: optStr,
  effective_on: optStr,
  status: z.enum(STATUSES).default("requested"),
  reason: optStr,
  notes: optStr,
});

async function requireEditor() {
  const profile = await getProfile();
  if (profile.role_tier < 2) throw new Error("You are not allowed to raise transfers.");
  return profile;
}

function payload(v: z.infer<typeof schema>) {
  return {
    personnel_id: v.personnel_id,
    from_site_id: v.from_site_id ?? null,
    to_site_id: v.to_site_id ?? null,
    requested_on: v.requested_on ?? new Date().toISOString().slice(0, 10),
    effective_on: v.effective_on ?? null,
    status: v.status,
    reason: v.reason ?? null,
    notes: v.notes ?? null,
  };
}

export async function createTransfer(values: Record<string, string>) {
  let profile;
  try { profile = await requireEditor(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  // Default the "from" site to where the person actually is now.
  let fromSite = parsed.data.from_site_id ?? null;
  if (!fromSite) {
    const { data } = await supabase
      .from("personnel")
      .select("site_id")
      .eq("id", parsed.data.personnel_id)
      .maybeSingle();
    fromSite = data?.site_id ?? null;
  }

  const { error } = await supabase.from("personnel_transfers").insert({
    ...payload(parsed.data),
    from_site_id: fromSite,
    requested_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

export async function updateTransfer(id: string, values: Record<string, string>) {
  try { await requireEditor(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("personnel_transfers").update(payload(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

/**
 * Move a transfer along. Completing it reassigns the person to the new site,
 * done by trigger so the record and the roster cannot disagree.
 */
export async function setTransferStatus(
  id: string,
  status: (typeof STATUSES)[number],
) {
  let profile;
  try { profile = await requireEditor(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();
  const { error } = await supabase
    .from("personnel_transfers")
    .update({
      status,
      decided_by: profile.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

export async function deleteTransfer(id: string) {
  const profile = await getProfile();
  if (profile.role_tier < 3) return { error: "Only administrators may delete transfers." };
  const supabase = createClient();
  const { error } = await supabase.from("personnel_transfers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

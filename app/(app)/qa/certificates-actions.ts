"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

const blank = (v: unknown) => (v === "" || v === "none" || v == null ? undefined : v);
const optStr = z.preprocess(blank, z.string().optional());

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  ho_no: optStr,
  position: optStr,
  certificate_no: optStr,
  issued_on: optStr,
  renewed_on: optStr,
  expires_on: optStr,
  site_id: z.preprocess(blank, z.string().uuid().optional()),
  personnel_id: z.preprocess(blank, z.string().uuid().optional()),
  issuer: optStr,
  notes: optStr,
});

async function requireEditor() {
  const profile = await getProfile();
  if (profile.role_tier < 2) throw new Error("You are not allowed to edit certificates.");
  return profile;
}

function payload(v: z.infer<typeof schema>) {
  return {
    name: v.name,
    ho_no: v.ho_no ?? null,
    position: v.position ?? null,
    certificate_no: v.certificate_no ?? null,
    issued_on: v.issued_on ?? null,
    renewed_on: v.renewed_on ?? null,
    expires_on: v.expires_on ?? null,
    site_id: v.site_id ?? null,
    personnel_id: v.personnel_id ?? null,
    issuer: v.issuer ?? null,
    notes: v.notes ?? null,
  };
}

export async function createCertificate(values: Record<string, string>) {
  let profile;
  try { profile = await requireEditor(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase
    .from("welder_certificates")
    .insert({ ...payload(parsed.data), created_by: profile.id });
  if (error) return { error: error.message };
  revalidatePath("/qa");
  return { error: null };
}

export async function updateCertificate(id: string, values: Record<string, string>) {
  try { await requireEditor(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase
    .from("welder_certificates")
    .update(payload(parsed.data))
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/qa");
  return { error: null };
}

export async function deleteCertificate(id: string) {
  const profile = await getProfile();
  if (profile.role_tier < 3) return { error: "Only administrators may delete certificates." };
  const supabase = createClient();
  const { error } = await supabase
    .from("welder_certificates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/qa");
  return { error: null };
}

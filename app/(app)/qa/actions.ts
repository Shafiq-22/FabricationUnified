"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

const optNum = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().optional(),
);
const optStr = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());
const pick = (v: string | undefined) => (v && v !== "none" ? v : null);

async function requireEngineer() {
  const profile = await getProfile();
  if (profile.role_tier < 2) throw new Error("You are not allowed to edit this.");
  return profile;
}

/* ---------------- Inspections ---------------- */
const inspSchema = z.object({
  job_id: optStr,
  item_ref: optStr,
  inspector_id: optStr,
  result: z.enum(["pass", "fail", "conditional"]),
  notes: optStr,
  inspected_at: optStr,
});

function inspPayload(v: z.infer<typeof inspSchema>) {
  return {
    job_id: pick(v.job_id),
    item_ref: v.item_ref ?? null,
    inspector_id: pick(v.inspector_id),
    result: v.result,
    notes: v.notes ?? null,
    ...(v.inspected_at ? { inspected_at: new Date(v.inspected_at).toISOString() } : {}),
  };
}

export async function createInspection(values: Record<string, string>) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = inspSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase
    .from("inspection_reports")
    .insert({ ...inspPayload(parsed.data), created_by: profile.id });
  if (error) return { error: error.message };
  revalidatePath("/qa");
  return { error: null };
}

export async function updateInspection(id: string, values: Record<string, string>) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = inspSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("inspection_reports").update(inspPayload(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/qa");
  return { error: null };
}

export async function deleteInspection(id: string) {
  const profile = await getProfile();
  if (profile.role_tier < 3) return { error: "Only administrators may delete inspections." };
  const supabase = createClient();
  const { error } = await supabase
    .from("inspection_reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/qa");
  return { error: null };
}

/* ---------------- NCRs ---------------- */
const ncrSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  job_id: optStr,
  project_id: optStr,
  item_ref: optStr,
  description: optStr,
  root_cause: optStr,
  corrective_action: optStr,
  severity: z.enum(["minor", "major", "critical"]),
  status: z.enum(["open", "in_progress", "closed"]),
});

function ncrPayload(v: z.infer<typeof ncrSchema>) {
  return {
    title: v.title.trim(),
    job_id: pick(v.job_id),
    project_id: pick(v.project_id),
    item_ref: v.item_ref ?? null,
    description: v.description ?? null,
    root_cause: v.root_cause ?? null,
    corrective_action: v.corrective_action ?? null,
    severity: v.severity,
    status: v.status,
    // Stamp/clear the closure time automatically with the status.
    closed_at: v.status === "closed" ? new Date().toISOString() : null,
  };
}

export async function createNcr(values: Record<string, string>) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = ncrSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase
    .from("ncrs")
    .insert({ ...ncrPayload(parsed.data), raised_by: profile.id, created_by: profile.id });
  if (error) return { error: error.message };
  revalidatePath("/qa");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateNcr(id: string, values: Record<string, string>) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = ncrSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("ncrs").update(ncrPayload(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/qa");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteNcr(id: string) {
  const profile = await getProfile();
  if (profile.role_tier < 3) return { error: "Only administrators may delete NCRs." };
  const supabase = createClient();
  const { error } = await supabase
    .from("ncrs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/qa");
  revalidatePath("/dashboard");
  return { error: null };
}

/* ---------------- Maintenance ---------------- */
const maintSchema = z.object({
  equipment_id: z.string().uuid("Select equipment"),
  performed_by: optStr,
  maintenance_type: z.enum(["scheduled", "breakdown", "inspection", "repair"]),
  description: optStr,
  downtime_hours: optNum,
  cost: optNum,
  performed_on: optStr,
});

export async function createMaintenance(values: Record<string, string>) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = maintSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const v = parsed.data;
  const supabase = createClient();
  const { error } = await supabase.from("maintenance_records").insert({
    equipment_id: v.equipment_id,
    performed_by: pick(v.performed_by),
    maintenance_type: v.maintenance_type,
    description: v.description ?? null,
    downtime_hours: v.downtime_hours ?? null,
    cost: v.cost ?? null,
    performed_on: v.performed_on || new Date().toISOString().slice(0, 10),
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

export async function deleteMaintenance(id: string) {
  const profile = await getProfile();
  if (profile.role_tier < 3) return { error: "Only administrators may delete maintenance records." };
  const supabase = createClient();
  const { error } = await supabase.from("maintenance_records").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

/** Set an equipment item's operational state. */
export async function setEquipmentStatus(id: string, status: string) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  if (!["operational", "down", "maintenance"].includes(status)) {
    return { error: "Invalid status." };
  }
  const supabase = createClient();
  const { error } = await supabase.from("equipment").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

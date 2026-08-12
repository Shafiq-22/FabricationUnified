"use server";

import { z } from "zod";
import { addMonths, parseISO, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit, isAdmin } from "@/lib/types";

const optNum = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().optional(),
);
const optStr = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());
/** Selects submit the sentinel "none" for an empty choice; store that as NULL. */
const pick = (v: string | undefined) => (v && v !== "none" ? v : null);

async function requireEngineer() {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) throw new Error("You are not allowed to edit this.");
  return profile;
}
async function requireAdmin() {
  const profile = await getProfile();
  if (!isAdmin(profile.role_tier)) throw new Error("Only administrators may delete.");
  return profile;
}

// ---- Personnel master ----------------------------------------------
const personSchema = z.object({
  ho_no: optStr,
  name: z.string().trim().min(1, "Name is required"),
  trade: optStr,
  // The form has collected these three since the Position/Site columns were
  // added, and the table renders them — but they were missing from this schema,
  // so zod stripped them and every save silently discarded the values.
  site_id: optStr,
  welder_qualification: optStr,
  qualification_expiry: optStr,
});

export async function addPersonnel(values: Record<string, string>) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = personSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("personnel").insert({
    ho_no: parsed.data.ho_no ?? null,
    name: parsed.data.name,
    trade: parsed.data.trade ?? null,
    site_id: pick(parsed.data.site_id),
    welder_qualification: parsed.data.welder_qualification ?? null,
    qualification_expiry: parsed.data.qualification_expiry ?? null,
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

export async function updatePersonnel(id: string, values: Record<string, string>) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = personSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("personnel").update({
    ho_no: parsed.data.ho_no ?? null,
    name: parsed.data.name,
    trade: parsed.data.trade ?? null,
    site_id: pick(parsed.data.site_id),
    welder_qualification: parsed.data.welder_qualification ?? null,
    qualification_expiry: parsed.data.qualification_expiry ?? null,
  }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

export async function togglePersonnel(id: string, active: boolean) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();
  const { error } = await supabase.from("personnel").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

export async function deletePersonnel(id: string) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();
  const { error } = await supabase.from("personnel").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

// ---- Equipment master ----------------------------------------------
const equipSchema = z.object({
  sixco_no: optStr,
  device_group: optStr,
  machine: z.string().trim().min(1, "Machine is required"),
  make: optStr,
  type: optStr,
  bare_rate: optNum,
  driver_rate: optNum,
});

export async function addEquipment(values: Record<string, string>) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = equipSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const v = parsed.data;
  const supabase = createClient();
  const { error } = await supabase.from("equipment").insert({
    sixco_no: v.sixco_no ?? null, device_group: v.device_group ?? null, machine: v.machine,
    make: v.make ?? null, type: v.type ?? null,
    bare_rate: v.bare_rate ?? null, driver_rate: v.driver_rate ?? null,
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

export async function updateEquipment(id: string, values: Record<string, string>) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = equipSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const v = parsed.data;
  const supabase = createClient();
  const { error } = await supabase.from("equipment").update({
    sixco_no: v.sixco_no ?? null, device_group: v.device_group ?? null, machine: v.machine,
    make: v.make ?? null, type: v.type ?? null,
    bare_rate: v.bare_rate ?? null, driver_rate: v.driver_rate ?? null,
  }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

export async function toggleEquipment(id: string, active: boolean) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();
  const { error } = await supabase.from("equipment").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

export async function deleteEquipment(id: string) {
  try { await requireAdmin(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();
  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/records");
  return { error: null };
}

// ---- Daily timesheet (replace-for-date) ----------------------------
export interface TimesheetRow {
  personnel_id: string;
  job_id?: string | null;
  begin_time?: string | null;
  end_time?: string | null;
  normal_hours?: number | null;
  ot_hours?: number | null;
  site?: string | null;
  job_description?: string | null;
  job_ref?: string | null;
}

export async function saveTimesheet(date: string, rows: TimesheetRow[]) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();

  const { error: delErr } = await supabase.from("timesheet_entries").delete().eq("entry_date", date);
  if (delErr) return { error: delErr.message };

  const payload = rows
    .filter((r) =>
      r.normal_hours != null || r.ot_hours != null || r.begin_time || r.end_time ||
      r.site || r.job_description || r.job_ref || r.job_id,
    )
    .map((r) => ({
      personnel_id: r.personnel_id,
      entry_date: date,
      job_id: r.job_id || null,
      begin_time: r.begin_time || null,
      end_time: r.end_time || null,
      normal_hours: r.normal_hours ?? null,
      ot_hours: r.ot_hours ?? null,
      site: r.site || null,
      job_description: r.job_description || null,
      job_ref: r.job_ref || null,
      created_by: profile.id,
    }));

  if (payload.length) {
    const { error } = await supabase.from("timesheet_entries").insert(payload);
    if (error) return { error: error.message };
  }
  revalidatePath("/records");
  return { error: null };
}

// ---- Monthly equipment usage (replace-for-month) -------------------
export interface UsageCell {
  equipment_id: string;
  date: string; // YYYY-MM-DD
  status_code: string;
}

export async function saveEquipmentUsage(month: string, cells: UsageCell[]) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();

  const start = `${month}-01`;
  const end = format(addMonths(parseISO(start), 1), "yyyy-MM-dd");

  const { error: delErr } = await supabase
    .from("equipment_usage")
    .delete()
    .gte("usage_date", start)
    .lt("usage_date", end);
  if (delErr) return { error: delErr.message };

  const payload = cells
    .filter((c) => c.status_code)
    .map((c) => ({
      equipment_id: c.equipment_id,
      usage_date: c.date,
      status_code: c.status_code,
      created_by: profile.id,
    }));

  if (payload.length) {
    const { error } = await supabase.from("equipment_usage").insert(payload);
    if (error) return { error: error.message };
  }
  revalidatePath("/records");
  return { error: null };
}

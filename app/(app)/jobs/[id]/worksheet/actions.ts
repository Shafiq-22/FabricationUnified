"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

// Editable columns per worksheet child table (computed cols are excluded).
const CHILD_TABLES = {
  job_quote_materials: ["material_name", "dimension", "unit", "qty", "unit_cost"],
  job_actual_materials: ["material_name", "dimension", "unit", "qty", "unit_cost"],
  job_quote_workforce: ["designation", "qty", "hrs_per_person", "date", "rate_aed_per_hr"],
  job_actual_workforce: ["designation", "qty", "hrs_per_person", "date", "rate_aed_per_hr"],
  job_quotation_summary: ["item_name", "unit", "qty", "unit_cost"],
  job_actual_summary: ["item_name", "unit", "qty", "unit_cost"],
  job_quote_consumables: ["item_name", "unit", "qty", "unit_cost"],
  job_actual_consumables: ["item_name", "unit", "qty", "unit_cost"],
  rough_sheet_items: ["profile_type", "dimension", "grade", "length_m", "qty"],
  cut_list_plates: ["thickness_mm", "plate_size", "grade", "length_mm", "width_mm", "qty"],
} as const;

export type ChildTable = keyof typeof CHILD_TABLES;

const NUMERIC = new Set([
  "qty",
  "unit_cost",
  "hrs_per_person",
  "rate_aed_per_hr",
  "length_m",
  "length_mm",
  "width_mm",
  "thickness_mm",
]);
const DATE = new Set(["date"]);

function sanitize(key: string, value: unknown): unknown {
  if (value === "" || value === undefined) return null;
  if (NUMERIC.has(key)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (DATE.has(key)) return value || null;
  return typeof value === "string" ? value : value ?? null;
}

export type Row = { id?: string } & Record<string, unknown>;

/**
 * Replace the full set of rows for a job's worksheet child table: upsert the
 * submitted rows and delete any that were removed. Engineer (Tier 2+) only.
 */
export async function replaceJobLines(
  jobId: string,
  table: ChildTable,
  rows: Row[],
): Promise<{ error: string | null }> {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "You are not allowed to edit worksheets." };

  const allowed = CHILD_TABLES[table];
  if (!allowed) return { error: "Invalid table." };

  const supabase = createClient();

  const { data: existing, error: selErr } = await supabase
    .from(table)
    .select("id")
    .eq("job_id", jobId);
  if (selErr) return { error: selErr.message };

  const keep = rows.filter((r) => r.id).map((r) => r.id as string);
  const toDelete = (existing ?? [])
    .map((e) => e.id)
    .filter((id) => !keep.includes(id));

  if (toDelete.length) {
    const { error } = await supabase.from(table).delete().in("id", toDelete);
    if (error) return { error: error.message };
  }

  const payload = rows.map((r, i) => {
    const obj: Record<string, unknown> = { job_id: jobId, seq_no: i + 1 };
    if (r.id) obj.id = r.id;
    for (const k of allowed) obj[k] = sanitize(k, r[k]);
    return obj;
  });

  if (payload.length) {
    // Dynamic table name + generic payload: the typed client can't infer here.
    const { error } = await supabase.from(table).upsert(payload as never);
    if (error) return { error: error.message };
  }

  // Re-derive the job's quote/final/margin/actual/P&L from all sections.
  await supabase.rpc("recompute_job_financials", { p_job_id: jobId });

  revalidatePath(`/jobs/${jobId}/worksheet`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function addComment(jobId: string, body: string) {
  const profile = await getProfile();
  const text = body.trim();
  if (!text) return { error: "Comment cannot be empty." };

  const supabase = createClient();
  const { error } = await supabase
    .from("job_comments")
    .insert({ job_id: jobId, user_id: profile.id, body: text });
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/worksheet`);
  return { error: null };
}

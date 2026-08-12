"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

// Editable columns per worksheet child table (computed cols are excluded).
const CHILD_TABLES = {
  job_quote_materials: ["part_ref", "material_name", "dimension", "unit", "qty", "unit_cost"],
  // Actual lines also record whether the material came out of existing stock.
  job_actual_materials: [
    "part_ref",
    "material_name",
    "dimension",
    "unit",
    "qty",
    "unit_cost",
    "inventory_item_id",
    "from_stock",
  ],
  job_quote_workforce: ["part_ref", "designation", "qty", "hrs_per_person", "date", "rate_aed_per_hr"],
  job_actual_workforce: ["part_ref", "designation", "qty", "hrs_per_person", "date", "rate_aed_per_hr"],
  job_quotation_summary: ["item_name", "unit", "qty", "unit_cost"],
  job_actual_summary: ["item_name", "unit", "qty", "unit_cost"],
  job_quote_consumables: ["part_ref", "item_name", "unit", "qty", "unit_cost"],
  job_actual_consumables: ["part_ref", "item_name", "unit", "qty", "unit_cost"],
  job_quote_equipment: ["part_ref", "equipment_id", "description", "with_driver", "hours", "rate_aed_per_hr"],
  job_actual_equipment: ["part_ref", "equipment_id", "description", "with_driver", "hours", "rate_aed_per_hr"],
  job_quote_services: ["part_ref", "service_name", "provider", "unit", "qty", "unit_cost"],
  job_actual_services: ["part_ref", "service_name", "provider", "unit", "qty", "unit_cost"],
  rough_sheet_items: ["profile_type", "dimension", "grade", "length_m", "qty"],
  cut_list_plates: ["thickness_mm", "plate_size", "grade", "length_mm", "width_mm", "qty"],
} as const;

export type ChildTable = keyof typeof CHILD_TABLES;

const NUMERIC = new Set([
  "qty",
  "hours",
  "unit_cost",
  "hrs_per_person",
  "rate_aed_per_hr",
  "length_m",
  "length_mm",
  "width_mm",
  "thickness_mm",
]);
const DATE = new Set(["date"]);
// Selects submit "" for "no machine"; booleans arrive as "true"/"false" strings.
const UUID = new Set(["equipment_id", "inventory_item_id"]);
const BOOL = new Set(["with_driver", "from_stock"]);

function sanitize(key: string, value: unknown): unknown {
  if (value === "" || value === undefined) return null;
  if (NUMERIC.has(key)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (DATE.has(key)) return value || null;
  if (UUID.has(key)) return value && value !== "none" ? value : null;
  if (BOOL.has(key)) return value === true || value === "true";
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

  // Every row carries an id, including brand-new ones. PostgREST builds one
  // INSERT for the whole batch from the union of the objects' keys, so a batch
  // mixing saved rows (with an id) and new rows (without) would send id => NULL
  // for the new ones and trip the not-null constraint rather than falling back
  // to the column's gen_random_uuid() default. Minting the id here keeps every
  // object the same shape.
  const payload = rows.map((r, i) => {
    const obj: Record<string, unknown> = {
      id: r.id || randomUUID(),
      job_id: jobId,
      seq_no: i + 1,
    };
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

/** Quote section -> the Actual section it seeds. Both sides share a shape. */
const QUOTE_TO_ACTUAL = {
  job_quote_materials: "job_actual_materials",
  job_quote_workforce: "job_actual_workforce",
  job_quote_consumables: "job_actual_consumables",
  job_quote_equipment: "job_actual_equipment",
  job_quote_services: "job_actual_services",
} as const satisfies Partial<Record<ChildTable, ChildTable>>;

/**
 * Seed the Actual worksheet from the Quotation, section by section, so the job
 * starts from what was quoted and is then corrected against what really
 * happened. This **replaces** whatever the Actual side currently holds — the
 * caller confirms first. Financials are recomputed once at the end.
 */
export async function copyQuoteToActual(
  jobId: string,
): Promise<{ error: string | null; copied?: number }> {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "You are not allowed to edit worksheets." };

  const supabase = createClient();
  let copied = 0;

  for (const [src, dest] of Object.entries(QUOTE_TO_ACTUAL) as [ChildTable, ChildTable][]) {
    const { data, error: readErr } = await supabase
      .from(src)
      .select("*")
      .eq("job_id", jobId)
      .order("seq_no");
    if (readErr) return { error: readErr.message };

    const { error: delErr } = await supabase.from(dest).delete().eq("job_id", jobId);
    if (delErr) return { error: delErr.message };

    if (!data?.length) continue;

    const cols = CHILD_TABLES[dest];
    const payload = data.map((row, i) => {
      const from = row as Record<string, unknown>;
      const obj: Record<string, unknown> = {
        id: randomUUID(),
        job_id: jobId,
        seq_no: i + 1,
      };
      // Only carry columns the quote side actually has. Destination-only
      // columns (from_stock, inventory_item_id) are left out entirely so they
      // take their defaults — every row here omits them identically, so the
      // batch still has one uniform shape.
      for (const k of cols) if (k in from) obj[k] = from[k];
      return obj;
    });

    const { error: insErr } = await supabase.from(dest).insert(payload as never);
    if (insErr) return { error: insErr.message };
    copied += payload.length;
  }

  await supabase.rpc("recompute_job_financials", { p_job_id: jobId });

  revalidatePath(`/jobs/${jobId}/worksheet`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { error: null, copied };
}

export async function addComment(
  jobId: string,
  body: string,
  mentions: string[] = [],
) {
  const profile = await getProfile();
  const text = body.trim();
  if (!text) return { error: "Comment cannot be empty." };

  const supabase = createClient();
  // Mentions decide who is notified: named people only, or every
  // collaborator when nobody is named. The fan-out is a database trigger.
  const { error } = await supabase.from("job_comments").insert({
    job_id: jobId,
    user_id: profile.id,
    body: text,
    mentions: mentions.length > 0 ? mentions : null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/worksheet`);
  return { error: null };
}

/**
 * Remove a comment. RLS allows the author or an administrator; the check is
 * repeated here so the UI gets a clear message instead of a silent no-op.
 */
export async function deleteComment(jobId: string, commentId: string) {
  const profile = await getProfile();
  const supabase = createClient();

  const { data: existing, error: readError } = await supabase
    .from("job_comments")
    .select("user_id")
    .eq("id", commentId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!existing) return { error: "That comment no longer exists." };
  if (existing.user_id !== profile.id && profile.role_tier < 3)
    return { error: "You can only delete your own comments." };

  const { error } = await supabase.from("job_comments").delete().eq("id", commentId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/worksheet`);
  return { error: null };
}

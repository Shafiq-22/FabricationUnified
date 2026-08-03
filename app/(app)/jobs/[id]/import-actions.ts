"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export type ImportTarget =
  | "rough_sheet_items"
  | "job_quote_materials"
  | "job_quote_consumables";

/** Editable columns per import target; anything else in the payload is dropped. */
const ALLOWED: Record<ImportTarget, string[]> = {
  rough_sheet_items: ["profile_type", "dimension", "length_m", "qty"],
  job_quote_materials: ["material_name", "unit", "qty", "unit_cost"],
  job_quote_consumables: ["item_name", "unit", "qty", "unit_cost"],
};

const NUMERIC = new Set(["qty", "unit_cost", "length_m"]);
const MAX_ROWS = 2000;

/**
 * Append imported rows to a job's cut list / MTO. Deliberately additive:
 * existing rows are never replaced, so a mis-mapped import can be deleted
 * without losing hand-entered work.
 */
export async function appendJobLines(
  jobId: string,
  target: ImportTarget,
  rows: Record<string, unknown>[],
): Promise<{ error: string | null; inserted?: number }> {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "You are not allowed to import." };

  const allowed = ALLOWED[target];
  if (!allowed) return { error: "Invalid import target." };
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Nothing to import." };
  if (rows.length > MAX_ROWS) {
    return { error: `Too many rows (${rows.length}). Import at most ${MAX_ROWS} at a time.` };
  }

  const supabase = createClient();

  // Continue numbering after whatever is already on the job.
  const { data: existing, error: seqErr } = await supabase
    .from(target)
    .select("seq_no")
    .eq("job_id", jobId)
    .order("seq_no", { ascending: false })
    .limit(1);
  if (seqErr) return { error: seqErr.message };
  let seq = Number(existing?.[0]?.seq_no ?? 0);

  const payload = rows.map((r) => {
    const obj: Record<string, unknown> = { job_id: jobId, seq_no: ++seq };
    for (const key of allowed) {
      const v = r[key];
      if (NUMERIC.has(key)) {
        const n = v === "" || v == null ? null : Number(v);
        obj[key] = Number.isFinite(n as number) ? n : null;
      } else {
        obj[key] = v == null || v === "" ? null : String(v);
      }
    }
    return obj;
  });

  const { error } = await supabase.from(target).insert(payload as never);
  if (error) return { error: error.message };

  // Materials/consumables feed the job's quote, so re-derive its financials.
  if (target !== "rough_sheet_items") {
    await supabase.rpc("recompute_job_financials", { p_job_id: jobId });
    revalidatePath("/jobs");
    revalidatePath("/dashboard");
  }
  revalidatePath(`/jobs/${jobId}/worksheet`);
  revalidatePath(`/jobs/${jobId}/roughsheet`);
  return { error: null, inserted: payload.length };
}

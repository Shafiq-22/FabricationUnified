"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSeeFinancials, isAdmin } from "@/lib/types";
import { MARGIN_SECTIONS, type MarginSection } from "@/lib/margins";

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
 * submitted rows and delete any that were removed. Restricted to tiers that
 * may see money, since every worksheet line is a cost.
 */
export async function replaceJobLines(
  jobId: string,
  table: ChildTable,
  rows: Row[],
): Promise<{ error: string | null }> {
  const profile = await getProfile();
  if (!canSeeFinancials(profile.role_tier)) return { error: "You are not allowed to edit worksheets." };

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

  // Material drawn from the yard has to leave the yard.
  if (table === "job_actual_materials") {
    const stockErr = await syncStockIssues(supabase, jobId, payload);
    if (stockErr) return { error: stockErr };
  }

  // Re-derive the job's quote/final/margin/actual/P&L from all sections.
  await supabase.rpc("recompute_job_financials", { p_job_id: jobId });

  revalidatePath(`/jobs/${jobId}/worksheet`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  return { error: null };
}

/**
 * Keep the stock ledger in step with the Actual material lines: one `issue`
 * movement per line that is marked as drawn from stock and names the item.
 *
 * Keyed on job_actual_material_id (unique), so saving the same section again
 * updates the movement in place instead of issuing the steel twice. Lines that
 * stop being stock-drawn have their movement removed here; lines deleted
 * outright are handled by the FK cascade, and on-hand corrects itself either
 * way because the trigger re-sums the whole ledger rather than applying a
 * delta. Quantity is stored signed, and an issue is negative.
 */
async function syncStockIssues(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  payload: Record<string, unknown>[],
): Promise<string | null> {
  const lineIds = payload.map((r) => r.id as string);
  if (lineIds.length === 0) return null;

  const wanted = payload.filter(
    (r) => r.from_stock === true && r.inventory_item_id && Number(r.qty) > 0,
  );
  const wantedIds = new Set(wanted.map((r) => r.id as string));

  // Lines that are no longer stock-drawn must not keep a movement.
  const stale = lineIds.filter((id) => !wantedIds.has(id));
  if (stale.length) {
    const { error } = await supabase
      .from("inventory_movements")
      .delete()
      .in("job_actual_material_id", stale);
    if (error) return error.message;
  }

  if (wanted.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const rows = wanted.map((r) => ({
    inventory_item_id: r.inventory_item_id as string,
    job_actual_material_id: r.id as string,
    job_id: jobId,
    movement_type: "issue",
    qty: -Math.abs(Number(r.qty)),
    moved_on: today,
    note: `Issued to job worksheet: ${String(r.material_name ?? "").trim() || "material"}`,
  }));

  const { error } = await supabase
    .from("inventory_movements")
    .upsert(rows as never, { onConflict: "job_actual_material_id" });
  return error ? error.message : null;
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
  if (!canSeeFinancials(profile.role_tier)) return { error: "You are not allowed to edit worksheets." };

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

/**
 * Write the Tentative tab's re-priced unit costs back onto the quoted lines,
 * so a quote can be built from historic pricing in one step instead of being
 * retyped. Matching is by item name, case- and whitespace-insensitive, which
 * is the same key the Tentative estimator looks prices up under. Lines with no
 * historic match are left exactly as they are.
 *
 * The prices come from the client because they are the figures the user is
 * looking at when they press the button. That grants nothing extra — anyone
 * who can call this could equally type the same unit cost into the table.
 */
export async function applyTentativeToQuote(
  jobId: string,
  prices: { name: string; kind: "Material" | "Consumable"; unitCost: number }[],
): Promise<{ error: string | null; updated?: number }> {
  const profile = await getProfile();
  if (!canSeeFinancials(profile.role_tier))
    return { error: "You are not allowed to edit worksheets." };

  const supabase = createClient();
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

  const wanted = new Map<string, number>();
  for (const p of prices) {
    if (!Number.isFinite(p.unitCost) || p.unitCost < 0) continue;
    wanted.set(`${p.kind}:${norm(p.name)}`, p.unitCost);
  }
  if (wanted.size === 0) return { error: "Nothing to apply — no historic prices matched." };

  let updated = 0;
  const sections = [
    { table: "job_quote_materials" as const, nameCol: "material_name", kind: "Material" as const },
    { table: "job_quote_consumables" as const, nameCol: "item_name", kind: "Consumable" as const },
  ];

  for (const s of sections) {
    // Selected with "*" rather than a template string: a computed column list
    // defeats the typed client's parsing of the select expression.
    const { data, error } = await supabase.from(s.table).select("*").eq("job_id", jobId);
    if (error) return { error: error.message };

    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      const price = wanted.get(`${s.kind}:${norm(r[s.nameCol])}`);
      if (price == null) continue;
      const { error: updErr } = await supabase
        .from(s.table)
        .update({ unit_cost: price })
        .eq("id", r.id as string);
      if (updErr) return { error: updErr.message };
      updated += 1;
    }
  }

  await supabase.rpc("recompute_job_financials", { p_job_id: jobId });

  revalidatePath(`/jobs/${jobId}/worksheet`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { error: null, updated };
}

/**
 * Raise Job Material Request lines in Procurement from a worksheet section.
 *
 * The rough sheet has had this since it was built; the worksheet tabs had no
 * route to Procurement at all, so a quoted or actually-used material had to be
 * retyped. Sources differ only in where the lines and prices come from:
 *   quotation — the quoted MTO, at its quoted unit cost
 *   actual    — what was really used, at its actual cost, skipping anything
 *               drawn from stock (that was never bought, so it is not a request)
 *   tentative — the quoted MTO at the re-priced historic figures the user is
 *               looking at, passed in the same way applyTentativeToQuote does
 *
 * Lines are appended, never deduplicated against what Procurement already
 * holds: pressing this twice is a real second request, and silently swallowing
 * it would hide that.
 */
export async function copyWorksheetToProcurement(
  jobId: string,
  source: "quotation" | "actual" | "tentative",
  tentativePrices?: { name: string; unitCost: number }[],
): Promise<{ error: string | null; count?: number }> {
  const profile = await getProfile();
  if (!canSeeFinancials(profile.role_tier))
    return { error: "You are not allowed to read the worksheet." };

  const supabase = createClient();
  const table = source === "actual" ? "job_actual_materials" : "job_quote_materials";

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("job_id", jobId)
    .order("seq_no");
  if (error) return { error: error.message };

  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const priceFor = new Map(
    (tentativePrices ?? []).map((p) => [norm(p.name), p.unitCost]),
  );

  const today = new Date().toISOString().slice(0, 10);
  const rows = (data ?? [])
    .map((row) => {
      const r = row as Record<string, unknown>;
      // Material already on the shelf was not purchased for this job.
      if (source === "actual" && r.from_stock === true) return null;

      const name = String(r.material_name ?? "").trim();
      if (!name) return null;

      const unitCost =
        source === "tentative"
          ? priceFor.get(norm(name)) ?? Number(r.unit_cost ?? 0)
          : Number(r.unit_cost ?? 0);
      const qty = r.qty == null ? null : Number(r.qty);

      return {
        job_id: jobId,
        request_date: today,
        item_name: name,
        dimension: (r.dimension as string) ?? null,
        unit: (r.unit as string) ?? null,
        qty,
        unit_price: Number.isFinite(unitCost) && unitCost > 0 ? unitCost : null,
        // total_price is GENERATED ALWAYS on job_materials -- writing it makes
        // Postgres reject the whole insert. It computes itself from qty * unit_price.
        created_by: profile.id,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return {
      error:
        source === "actual"
          ? "Nothing to request — the Actual materials are empty, or every line came from stock."
          : "Nothing to request — add Material MTO lines first.",
    };
  }

  const { error: insErr } = await supabase.from("job_materials").insert(rows as never);
  if (insErr) return { error: insErr.message };

  revalidatePath("/procurement");
  revalidatePath(`/jobs/${jobId}/worksheet`);
  return { error: null, count: rows.length };
}


/**
 * Set this job's own margin per section. A null (blank) entry clears the
 * override so the section falls back to the Settings default — that fallback
 * lives in recompute_job_financials, not here, so the database stays the one
 * authority on what a job is worth.
 *
 * Unlike the old display-only toggle this really does move the quote, so it
 * recomputes and revalidates the job lists and dashboard afterwards.
 */
export async function setJobMargins(
  jobId: string,
  overrides: Partial<Record<MarginSection, number | null>>,
): Promise<{ error: string | null }> {
  const profile = await getProfile();
  if (!canSeeFinancials(profile.role_tier))
    return { error: "You are not allowed to change margins." };

  const patch: Record<string, number | null> = {};
  for (const s of MARGIN_SECTIONS) {
    if (!(s.key in overrides)) continue;
    const v = overrides[s.key];
    if (v == null) {
      patch[s.column] = null;
      continue;
    }
    if (!Number.isFinite(v) || v < -100 || v > 1000)
      return { error: `${s.label} margin must be a percentage between -100 and 1000.` };
    patch[s.column] = v;
  }
  if (Object.keys(patch).length === 0) return { error: "Nothing to save." };

  const supabase = createClient();
  // Column names are built from MARGIN_SECTIONS, so the typed client cannot
  // narrow the patch shape — same cast the other dynamic writes here use.
  const { error } = await supabase.from("jobs").update(patch as never).eq("id", jobId);
  if (error) return { error: error.message };

  await supabase.rpc("recompute_job_financials", { p_job_id: jobId });

  revalidatePath(`/jobs/${jobId}/worksheet`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { error: null };
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
  if (existing.user_id !== profile.id && !isAdmin(profile.role_tier))
    return { error: "You can only delete your own comments." };

  const { error } = await supabase.from("job_comments").delete().eq("id", commentId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/worksheet`);
  return { error: null };
}

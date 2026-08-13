"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { supplierNameFor } from "./supplier-actions";
import { canEdit, isAdmin } from "@/lib/types";

const optNum = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().optional(),
);
const optStr = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const schema = z.object({
  request_date: optStr,
  order_date: optStr,
  job_id: optStr,
  item_name: z.string().trim().min(1, "Item is required"),
  dimension: optStr,
  grade: optStr,
  unit: optStr,
  qty: optNum,
  unit_price: optNum,
  pr_no: optStr,
  lpo_no: optStr,
  invoice_dn_no: optStr,
  delivery_date: optStr,
  supplier: optStr,
  supplier_id: optStr,
});

/**
 * `supplierName` is resolved from supplier_id by the caller; the legacy
 * free-text `supplier` column is kept populated for backwards compatibility.
 */
function payload(v: z.infer<typeof schema>, supplierName: string | null) {
  const supplierId = v.supplier_id && v.supplier_id !== "none" ? v.supplier_id : null;
  return {
    supplier_id: supplierId,
    supplier: supplierName ?? v.supplier ?? null,
    request_date: v.request_date ?? null,
    order_date: v.order_date ?? null,
    job_id: v.job_id && v.job_id !== "none" ? v.job_id : null,
    item_name: v.item_name,
    dimension: v.dimension ?? null,
    grade: v.grade ?? null,
    unit: v.unit ?? null,
    qty: v.qty ?? null,
    unit_price: v.unit_price ?? null,
    pr_no: v.pr_no ?? null,
    lpo_no: v.lpo_no ?? null,
    invoice_dn_no: v.invoice_dn_no ?? null,
    delivery_date: v.delivery_date ?? null,
  };
}

export async function createJobMaterial(values: Record<string, string>) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const supplierName = await supplierNameFor(parsed.data.supplier_id);
  const { error } = await supabase
    .from("job_materials")
    .insert({ ...payload(parsed.data, supplierName), created_by: profile.id });
  if (error) return { error: error.message };
  revalidatePath("/procurement");
  return { error: null };
}

export async function updateJobMaterial(id: string, values: Record<string, string>) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const supplierName = await supplierNameFor(parsed.data.supplier_id);
  const { error } = await supabase
    .from("job_materials")
    .update(payload(parsed.data, supplierName))
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/procurement");
  return { error: null };
}

/**
 * Patch just the fields procurement chases day to day — who it was ordered
 * from, the PR and LPO numbers, and the order / delivery dates — so the
 * grouped view (the default one) can be worked in directly instead of
 * switching to the flat view for every change.
 *
 * Only the keys actually sent are written, so editing one cell never blanks
 * the rest of the row. `supplier` (the legacy free-text column) is kept in
 * step with `supplier_id`, exactly as the full-row editor does.
 */
const INLINE_FIELDS = ["supplier_id", "pr_no", "lpo_no", "order_date", "delivery_date"] as const;

type InlinePatch = Partial<Record<(typeof INLINE_FIELDS)[number] | "supplier", string | null>>;

export async function updateProcurementLine(
  kind: "material" | "consumable",
  id: string,
  values: Record<string, string>,
) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };

  const patch: InlinePatch = {};
  for (const k of INLINE_FIELDS) {
    if (!(k in values)) continue;
    const raw = (values[k] ?? "").trim();
    patch[k] = raw === "" || raw === "none" ? null : raw;
  }
  if (Object.keys(patch).length === 0) return { error: null };
  if ("supplier_id" in patch) patch.supplier = await supplierNameFor(patch.supplier_id);

  const supabase = createClient();
  // Both registers carry these same five columns; the row type differs, hence
  // the cast (the keys themselves are fixed by INLINE_FIELDS above).
  const { error } = await supabase
    .from(kind === "consumable" ? "consumables" : "job_materials")
    .update(patch as never)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/procurement");
  if (kind === "consumable") {
    revalidatePath("/consumables");
    revalidatePath("/dashboard");
  }
  return { error: null };
}

export async function deleteJobMaterial(id: string) {
  const profile = await getProfile();
  if (!isAdmin(profile.role_tier)) return { error: "Only administrators may delete." };
  const supabase = createClient();
  const { error } = await supabase
    .from("job_materials")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/procurement");
  return { error: null };
}

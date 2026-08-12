"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit } from "@/lib/types";

/**
 * Pre-fill procurement (job_materials) from the rough-sheet order list:
 * one line per aggregated section (order_qty bars) and per plate group
 * (sheets_required sheets).
 */
export async function copyOrderListToProcurement(jobId: string) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const supabase = createClient();

  const [{ data: sections }, { data: plates }] = await Promise.all([
    supabase
      .from("rough_sheet_aggregated")
      .select("profile_type, dimension, order_qty")
      .eq("job_id", jobId),
    supabase
      .from("cut_list_plates_aggregated")
      .select("thickness_mm, plate_size, sheets_required")
      .eq("job_id", jobId),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const rows = [
    ...(sections ?? []).map((s) => ({
      job_id: jobId,
      request_date: today,
      item_name: `${s.profile_type ?? ""} ${s.dimension ?? ""}`.trim(),
      unit: "bars (6m)",
      qty: s.order_qty,
      created_by: profile.id,
    })),
    ...(plates ?? []).map((p) => ({
      job_id: jobId,
      request_date: today,
      item_name: `Plate ${p.thickness_mm ?? ""}mm ${p.plate_size ?? ""}`.trim(),
      unit: "sheets",
      qty: p.sheets_required,
      created_by: profile.id,
    })),
  ];

  if (rows.length === 0) {
    return { error: "Nothing to copy — add cut-list items first." };
  }

  const { error } = await supabase.from("job_materials").insert(rows as never);
  if (error) return { error: error.message };

  revalidatePath("/procurement");
  return { error: null, count: rows.length };
}

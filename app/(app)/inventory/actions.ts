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

const itemSchema = z.object({
  item_code: optStr,
  item_type: z.enum(["plate", "section", "consumable", "remnant"]).default("section"),
  description: z.string().trim().min(1, "Description is required"),
  material_grade: optStr,
  dimensions: optStr,
  unit: optStr,
  reorder_threshold: optNum,
  warehouse_location: optStr,
  unit_cost: optNum,
});

function itemPayload(v: z.infer<typeof itemSchema>) {
  return {
    item_code: v.item_code ?? null,
    item_type: v.item_type,
    description: v.description,
    material_grade: v.material_grade ?? null,
    dimensions: v.dimensions ?? null,
    unit: v.unit ?? "pcs",
    reorder_threshold: v.reorder_threshold ?? null,
    warehouse_location: v.warehouse_location ?? null,
    unit_cost: v.unit_cost ?? null,
  };
}

const DUP = "An item with this code already exists.";

export async function createInventoryItem(values: Record<string, string>) {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "Not authorized." };
  const parsed = itemSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  const { error } = await supabase
    .from("inventory_items")
    .insert({ ...itemPayload(parsed.data), created_by: profile.id });
  if (error) return { error: error.code === "23505" ? DUP : error.message };
  revalidatePath("/inventory");
  return { error: null };
}

export async function updateInventoryItem(id: string, values: Record<string, string>) {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "Not authorized." };
  const parsed = itemSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  const { error } = await supabase.from("inventory_items").update(itemPayload(parsed.data)).eq("id", id);
  if (error) return { error: error.code === "23505" ? DUP : error.message };
  revalidatePath("/inventory");
  return { error: null };
}

export async function toggleInventoryItem(id: string, active: boolean) {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "Not authorized." };
  const supabase = createClient();
  const { error } = await supabase.from("inventory_items").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  return { error: null };
}

export async function deleteInventoryItem(id: string) {
  const profile = await getProfile();
  if (profile.role_tier < 3) return { error: "Only administrators may delete stock items." };
  const supabase = createClient();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  return { error: null };
}

// ---- Movements ------------------------------------------------------
const moveSchema = z.object({
  inventory_item_id: z.string().uuid("Select a stock item"),
  movement_type: z.enum(["receipt", "issue", "adjustment", "remnant"]),
  qty: z.coerce.number().refine((n) => n !== 0, "Quantity cannot be zero"),
  job_id: optStr,
  moved_on: optStr,
  note: optStr,
});

/**
 * Quantity is stored signed. Receipts/remnants add, issues subtract; the UI
 * takes a positive number and the sign is applied here so a mistyped minus
 * can't silently invert a movement. Adjustments keep the sign as entered.
 */
export async function addMovement(values: Record<string, string>) {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "Not authorized." };
  const parsed = moveSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  const magnitude = Math.abs(v.qty);
  const qty =
    v.movement_type === "issue"
      ? -magnitude
      : v.movement_type === "adjustment"
        ? v.qty
        : magnitude;

  const supabase = createClient();
  const { error } = await supabase.from("inventory_movements").insert({
    inventory_item_id: v.inventory_item_id,
    movement_type: v.movement_type,
    qty,
    job_id: v.job_id && v.job_id !== "none" ? v.job_id : null,
    moved_on: v.moved_on || new Date().toISOString().slice(0, 10),
    note: v.note ?? null,
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteMovement(id: string) {
  const profile = await getProfile();
  if (profile.role_tier < 3) return { error: "Only administrators may delete movements." };
  const supabase = createClient();
  const { error } = await supabase.from("inventory_movements").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { error: null };
}

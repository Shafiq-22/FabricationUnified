"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

const optNum = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().optional(),
);
const optStr = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().optional(),
);

const schema = z.object({
  order_date: optStr,
  item_name: z.string().trim().min(1, "Item is required"),
  unit: optStr,
  qty: optNum,
  unit_price: optNum,
  pr_no: optStr,
  lpo_no: optStr,
  invoice_dn_no: optStr,
  delivery_date: optStr,
  supplier: optStr,
});

function payload(v: z.infer<typeof schema>) {
  // undefined -> null so updates can clear fields. total_price/month_year are generated.
  return {
    order_date: v.order_date ?? null,
    item_name: v.item_name,
    unit: v.unit ?? null,
    qty: v.qty ?? null,
    unit_price: v.unit_price ?? null,
    pr_no: v.pr_no ?? null,
    lpo_no: v.lpo_no ?? null,
    invoice_dn_no: v.invoice_dn_no ?? null,
    delivery_date: v.delivery_date ?? null,
    supplier: v.supplier ?? null,
  };
}

export async function createConsumable(values: Record<string, string>) {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "Not authorized." };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  const { error } = await supabase
    .from("consumables")
    .insert({ ...payload(parsed.data), created_by: profile.id });
  if (error) return { error: error.message };
  revalidatePath("/consumables");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateConsumable(id: string, values: Record<string, string>) {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "Not authorized." };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  const { error } = await supabase.from("consumables").update(payload(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/consumables");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteConsumable(id: string) {
  const profile = await getProfile();
  if (profile.role_tier < 3) return { error: "Only administrators may delete." };
  const supabase = createClient();
  const { error } = await supabase
    .from("consumables")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/consumables");
  revalidatePath("/dashboard");
  return { error: null };
}

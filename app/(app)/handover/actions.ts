"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit, isAdmin } from "@/lib/types";

const optNum = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().optional(),
);
const optStr = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const handoverSchema = z.object({
  job_id: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  job_description: z.string().trim().min(1, "Description is required"),
  qty: optNum,
  site_id: optStr,
  po_ref: optStr,
  supplier: optStr,
  expected_completion: optStr,
  remark: optStr,
});

function handoverPayload(v: z.infer<typeof handoverSchema>) {
  return {
    job_id: v.job_id && v.job_id !== "none" ? v.job_id : null,
    job_description: v.job_description,
    qty: v.qty ?? null,
    site_id: v.site_id && v.site_id !== "none" ? v.site_id : null,
    po_ref: v.po_ref ?? null,
    supplier: v.supplier ?? null,
    expected_completion: v.expected_completion ?? null,
    remark: v.remark ?? null,
  };
}

export async function createHandover(
  type: "active" | "forecasted",
  values: Record<string, string>,
) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const parsed = handoverSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase
    .from("handover_items")
    .insert({ ...handoverPayload(parsed.data), type, created_by: profile.id });
  if (error) return { error: error.message };
  revalidatePath("/handover");
  return { error: null };
}

export async function updateHandover(id: string, values: Record<string, string>) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const parsed = handoverSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase
    .from("handover_items")
    .update(handoverPayload(parsed.data))
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/handover");
  return { error: null };
}

export async function deleteHandover(id: string) {
  const profile = await getProfile();
  if (!isAdmin(profile.role_tier)) return { error: "Only administrators may delete." };
  const supabase = createClient();
  const { error } = await supabase
    .from("handover_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/handover");
  return { error: null };
}

const drawingSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  status: optStr,
  submitted_to: optStr,
  notes: optStr,
});

export async function addDrawing(handoverId: string, values: Record<string, string>) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const parsed = drawingSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("drawings").insert({
    handover_id: handoverId,
    title: parsed.data.title,
    status: parsed.data.status ?? null,
    submitted_to: parsed.data.submitted_to ?? null,
    notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/handover");
  return { error: null };
}

export async function deleteDrawing(id: string) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const supabase = createClient();
  const { error } = await supabase.from("drawings").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/handover");
  return { error: null };
}

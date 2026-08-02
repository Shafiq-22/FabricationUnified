"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { DOCUMENTS_BUCKET } from "@/lib/storage";

const optStr = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const metaSchema = z.object({
  job_id: optStr,
  doc_type: z.enum(["drawing", "invoice", "po", "inspection_report", "photo", "email", "other"]),
  title: optStr,
  revision: optStr,
  notes: optStr,
  file_path: z.string().min(1),
  original_filename: optStr,
  mime_type: optStr,
  size_bytes: z.coerce.number().optional(),
});

/**
 * Records an already-uploaded storage object. The file itself is streamed to
 * Storage from the browser so large drawings never pass through the server.
 */
export async function registerDocument(values: Record<string, unknown>) {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "Not authorized." };
  const parsed = metaSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  const supabase = createClient();
  const { error } = await supabase.from("documents").insert({
    job_id: v.job_id && v.job_id !== "none" ? v.job_id : null,
    doc_type: v.doc_type,
    title: v.title ?? v.original_filename ?? null,
    revision: v.revision ?? null,
    notes: v.notes ?? null,
    file_path: v.file_path,
    original_filename: v.original_filename ?? null,
    mime_type: v.mime_type ?? null,
    size_bytes: v.size_bytes ?? null,
    uploaded_by: profile.id,
  });
  if (error) {
    // Don't leave an orphaned object behind if the row insert fails.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([v.file_path]);
    return { error: error.message };
  }

  revalidatePath("/documents");
  if (v.job_id) revalidatePath(`/jobs/${v.job_id}/worksheet`);
  return { error: null };
}

export async function updateDocument(id: string, values: Record<string, string>) {
  const profile = await getProfile();
  if (profile.role_tier < 2) return { error: "Not authorized." };

  const schema = z.object({
    doc_type: z.enum(["drawing", "invoice", "po", "inspection_report", "photo", "email", "other"]),
    title: optStr,
    revision: optStr,
    notes: optStr,
    job_id: optStr,
  });
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  const supabase = createClient();
  const { error } = await supabase
    .from("documents")
    .update({
      doc_type: v.doc_type,
      title: v.title ?? null,
      revision: v.revision ?? null,
      notes: v.notes ?? null,
      job_id: v.job_id && v.job_id !== "none" ? v.job_id : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/documents");
  return { error: null };
}

/** Short-lived signed URL — the bucket is private, so nothing is public. */
export async function getDownloadUrl(filePath: string) {
  const profile = await getProfile();
  if (profile.role_tier < 1) return { error: "Not authorized.", url: null };
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(filePath, 60);
  if (error) return { error: error.message, url: null };
  return { error: null, url: data.signedUrl };
}

/** Soft delete (admin only, enforced again by the guard_soft_delete trigger). */
export async function deleteDocument(id: string) {
  const profile = await getProfile();
  if (profile.role_tier < 3) return { error: "Only administrators may delete documents." };
  const supabase = createClient();
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/documents");
  return { error: null };
}

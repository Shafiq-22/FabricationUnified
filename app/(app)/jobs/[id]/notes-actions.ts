"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit, isAdmin } from "@/lib/types";

/**
 * Job notes: a dated, numbered record against the job. Deliberately separate
 * from the comment thread — a note is a record, not a message, so nobody is
 * notified. Every tier may write one, including tier 2, which cannot see the
 * worksheet.
 *
 * The running number is allocated by a database trigger, not here, so two
 * people adding a note at once cannot land on the same number.
 */
export async function addJobNote(jobId: string, body: string) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "You are not allowed to add notes." };

  const text = body.trim();
  if (!text) return { error: "The note is empty." };
  if (text.length > 5000) return { error: "That note is too long (5000 characters max)." };

  const supabase = createClient();
  const { error } = await supabase
    .from("job_notes")
    .insert({ job_id: jobId, body: text, created_by: profile.id, seq_no: 0 });
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/worksheet`);
  return { error: null };
}

export async function updateJobNote(jobId: string, noteId: string, body: string) {
  const profile = await getProfile();
  const text = body.trim();
  if (!text) return { error: "The note is empty." };

  const supabase = createClient();
  const { data: existing, error: readErr } = await supabase
    .from("job_notes")
    .select("created_by")
    .eq("id", noteId)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!existing) return { error: "That note no longer exists." };
  if (existing.created_by !== profile.id && !isAdmin(profile.role_tier))
    return { error: "You can only edit your own notes." };

  const { error } = await supabase.from("job_notes").update({ body: text }).eq("id", noteId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/worksheet`);
  return { error: null };
}

/**
 * Soft delete, so the numbering stays honest: note 4 is always note 4, and
 * removing it leaves a gap rather than shuffling the notes after it.
 */
export async function deleteJobNote(jobId: string, noteId: string) {
  const profile = await getProfile();

  const supabase = createClient();
  const { data: existing, error: readErr } = await supabase
    .from("job_notes")
    .select("created_by")
    .eq("id", noteId)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!existing) return { error: "That note no longer exists." };
  if (existing.created_by !== profile.id && !isAdmin(profile.role_tier))
    return { error: "You can only delete your own notes." };

  const { error } = await supabase
    .from("job_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", noteId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/worksheet`);
  return { error: null };
}

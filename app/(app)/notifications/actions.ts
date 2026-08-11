"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

/** Mark one notification read. RLS already limits this to your own inbox. */
export async function markRead(id: string) {
  await getProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  return { error: null };
}

export async function markAllRead() {
  const profile = await getProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  return { error: null };
}

export async function dismissNotification(id: string) {
  await getProfile();
  const supabase = createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  return { error: null };
}

/**
 * Watch or mute a job. Muting writes an explicit row rather than deleting
 * one, so someone who is a collaborator by derivation can still opt out.
 */
export async function setJobWatch(jobId: string, watching: boolean) {
  const profile = await getProfile();
  const supabase = createClient();
  const { error } = await supabase
    .from("job_watchers")
    .upsert(
      { job_id: jobId, user_id: profile.id, watching },
      { onConflict: "job_id,user_id" },
    );
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}/worksheet`);
  return { error: null };
}

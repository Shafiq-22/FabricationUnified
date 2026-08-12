"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit, isAdmin } from "@/lib/types";

export type ActionState = { error: string | null };

const createSchema = z.object({
  site_id: z.string().uuid({ message: "Select a site" }),
  description: z.string().trim().min(1, "Description is required"),
  status: z.enum(["quotation", "in_progress", "completed", "delivered", "halt"]),
  unit: z.string().trim().optional(),
  qty: z.coerce.number().nonnegative().optional(),
  start_date: z.string().optional(),
  company_job_code: z.string().trim().optional(),
  quotation_ref: z.string().trim().optional(),
  project_id: z.string().trim().optional(),
});

// NOTE: jobs base-table SELECT is revoked from `authenticated`; we generate the
// id client-side and never chain .select() on jobs. Reads go via jobs_view.
export async function createJob(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "You are not allowed to create jobs." };

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  const id = randomUUID();
  const supabase = createClient();

  const { error } = await supabase.from("jobs").insert({
    id,
    site_id: v.site_id,
    description: v.description,
    status: v.status,
    unit: v.unit || null,
    qty: v.qty ?? null,
    start_date: v.start_date || null,
    company_job_code: v.company_job_code || null,
    quotation_ref: v.quotation_ref || null,
    project_id: v.project_id && v.project_id !== "none" ? v.project_id : null,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect(`/jobs/${id}/worksheet`);
}

export async function updateJobStatus(jobId: string, status: string) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const supabase = createClient();
  const { error } = await supabase.from("jobs").update({ status }).eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}/worksheet`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { error: null };
}

const detailsSchema = z.object({
  description: z.string().trim().optional(),
  company_job_code: z.string().trim().optional(),
  quotation_ref: z.string().trim().optional(),
  site_id: z.string().uuid().optional(),
  unit: z.string().trim().optional(),
  qty: z.coerce.number().optional().nullable(),
  start_date: z.string().optional().nullable(),
  completion_date: z.string().optional().nullable(),
  charge_to_site: z.coerce.number().optional().nullable(),
  quote_before_margin: z.coerce.number().optional().nullable(),
  margin: z.coerce.number().min(0).max(1).optional().nullable(),
  actual_cost: z.coerce.number().optional().nullable(),
  requisition_no: z.string().trim().optional(),
  lpo_ref: z.string().trim().optional(),
  inbound_outpass: z.string().trim().optional(),
  exit_outpass: z.string().trim().optional(),
  comments: z.string().optional(),
});

export async function updateJobDetails(
  jobId: string,
  values: Record<string, unknown>,
) {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) return { error: "Not authorized." };
  const parsed = detailsSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  // Normalise empty date strings to null.
  const patch: Record<string, unknown> = { ...parsed.data };
  for (const k of ["start_date", "completion_date"]) {
    if (patch[k] === "") patch[k] = null;
  }

  const supabase = createClient();
  const { error } = await supabase.from("jobs").update(patch as never).eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}/worksheet`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function softDeleteJob(jobId: string) {
  const profile = await getProfile();
  if (!isAdmin(profile.role_tier)) return { error: "Only administrators may delete jobs." };
  const supabase = createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect("/jobs");
}

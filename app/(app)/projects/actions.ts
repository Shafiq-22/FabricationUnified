"use server";

import { randomUUID } from "crypto";
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
const pick = (v: string | undefined) => (v && v !== "none" ? v : null);

async function requireEngineer() {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) throw new Error("You are not allowed to edit this.");
  return profile;
}

/* ---------------- Clients ---------------- */
const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  contact_name: optStr,
  contact_email: optStr,
  contact_phone: optStr,
  address: optStr,
});
const DUP_CLIENT = "A client with this name already exists.";

function clientPayload(v: z.infer<typeof clientSchema>) {
  return {
    name: v.name.trim(),
    contact_name: v.contact_name ?? null,
    contact_email: v.contact_email ?? null,
    contact_phone: v.contact_phone ?? null,
    address: v.address ?? null,
  };
}

export async function createClientRecord(values: Record<string, string>) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase
    .from("clients")
    .insert({ ...clientPayload(parsed.data), created_by: profile.id });
  if (error) return { error: error.code === "23505" ? DUP_CLIENT : error.message };
  revalidatePath("/clients");
  return { error: null };
}

export async function updateClientRecord(id: string, values: Record<string, string>) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("clients").update(clientPayload(parsed.data)).eq("id", id);
  if (error) return { error: error.code === "23505" ? DUP_CLIENT : error.message };
  revalidatePath("/clients");
  return { error: null };
}

export async function toggleClientActive(id: string, active: boolean) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();
  const { error } = await supabase.from("clients").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clients");
  return { error: null };
}

export async function deleteClientRecord(id: string) {
  const profile = await getProfile();
  if (!isAdmin(profile.role_tier)) return { error: "Only administrators may delete clients." };
  const supabase = createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "This client has linked projects — deactivate it instead."
          : error.message,
    };
  }
  revalidatePath("/clients");
  return { error: null };
}

/* ---------------- Projects ---------------- */
const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  client_id: optStr,
  site_id: optStr,
  status: z.enum([
    "rfq", "quoted", "won", "in_fabrication", "qa", "dispatch", "installed", "closed", "lost",
  ]),
  contract_value: optNum,
  start_date: optStr,
  target_completion: optStr,
  actual_completion: optStr,
  notes: optStr,
});

function projectPayload(v: z.infer<typeof projectSchema>) {
  return {
    name: v.name.trim(),
    client_id: pick(v.client_id),
    site_id: pick(v.site_id),
    status: v.status,
    contract_value: v.contract_value ?? null,
    start_date: v.start_date ?? null,
    target_completion: v.target_completion ?? null,
    actual_completion: v.actual_completion ?? null,
    notes: v.notes ?? null,
  };
}

export async function createProject(values: Record<string, string>) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = projectSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  // project_code is allocated by trigger; don't select it back (base table read is revoked).
  const { error } = await supabase
    .from("projects")
    .insert({ ...projectPayload(parsed.data), created_by: profile.id });
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { error: null };
}

/**
 * Create a project and attach jobs to it in one go, from the full-page form.
 * The id is minted here rather than read back, because select on the projects
 * base table is revoked (only projects_view is readable).
 */
export async function createProjectWithJobs(
  values: Record<string, string>,
  jobIds: string[],
) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message, id: null }; }
  const parsed = projectSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input.", id: null };

  const supabase = createClient();
  const id = randomUUID();
  const { error } = await supabase
    .from("projects")
    .insert({ id, ...projectPayload(parsed.data), created_by: profile.id });
  if (error) return { error: error.message, id: null };

  if (jobIds.length > 0) {
    // `is null` guards the race where someone claimed a job while this form
    // was open — an already-claimed job is left where it is.
    const { error: linkError } = await supabase
      .from("jobs")
      .update({ project_id: id })
      .in("id", jobIds)
      .is("project_id", null);
    if (linkError) return { error: `Project created, but jobs could not be attached: ${linkError.message}`, id };
  }

  revalidatePath("/projects");
  revalidatePath("/jobs");
  return { error: null, id };
}

/** Replace the set of jobs attached to a project, from the project page. */
export async function setProjectJobs(projectId: string, jobIds: string[]) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();
  const wanted = new Set(jobIds);

  const { data: attached, error: readError } = await supabase
    .from("jobs_view")
    .select("id")
    .eq("project_id", projectId);
  if (readError) return { error: readError.message };

  const toDetach = (attached ?? [])
    .map((j) => j.id as string | null)
    .filter((id): id is string => !!id && !wanted.has(id));

  if (toDetach.length > 0) {
    const { error } = await supabase
      .from("jobs")
      .update({ project_id: null })
      .in("id", toDetach);
    if (error) return { error: error.message };
  }

  // Claim the newly selected jobs that nobody else holds. `is null` leaves a
  // job alone if someone else attached it while this dialog was open.
  if (jobIds.length > 0) {
    const { error } = await supabase
      .from("jobs")
      .update({ project_id: projectId })
      .in("id", jobIds)
      .is("project_id", null);
    if (error) return { error: error.message };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/jobs");
  return { error: null };
}

export async function updateProject(id: string, values: Record<string, string>) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = projectSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("projects").update(projectPayload(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { error: null };
}

export async function deleteProject(id: string) {
  const profile = await getProfile();
  if (!isAdmin(profile.role_tier)) return { error: "Only administrators may delete projects." };
  const supabase = createClient();
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { error: null };
}

/** Attach/detach a job to a project (used from the Jobs UI). */
export async function setJobProject(jobId: string, projectId: string | null) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ project_id: projectId && projectId !== "none" ? projectId : null })
    .eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  revalidatePath("/jobs");
  return { error: null };
}

/** Remove a single job from its project, leaving the job itself intact. */
export async function detachJobFromProject(projectId: string, jobId: string) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const supabase = createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ project_id: null })
    .eq("id", jobId)
    .eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/jobs");
  return { error: null };
}

/** Soft-delete the job itself. Administrators only, as on the Jobs tab. */
export async function deleteJobFromProject(projectId: string, jobId: string) {
  const profile = await getProfile();
  if (!isAdmin(profile.role_tier)) return { error: "Only administrators may delete jobs." };
  const supabase = createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/jobs");
  return { error: null };
}

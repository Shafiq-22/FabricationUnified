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
const pick = (v: string | undefined) => (v && v !== "none" ? v : null);

async function requireEngineer() {
  const profile = await getProfile();
  if (profile.role_tier < 2) throw new Error("You are not allowed to edit this.");
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
  if (profile.role_tier < 3) return { error: "Only administrators may delete clients." };
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
  if (profile.role_tier < 3) return { error: "Only administrators may delete projects." };
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

/* ---------------- RFQs ---------------- */
const rfqSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  client_id: optStr,
  project_id: optStr,
  job_id: optStr,
  received_date: optStr,
  due_date: optStr,
  status: z.enum(["open", "quoted", "won", "lost", "cancelled"]),
  notes: optStr,
});

function rfqPayload(v: z.infer<typeof rfqSchema>) {
  return {
    title: v.title.trim(),
    client_id: pick(v.client_id),
    project_id: pick(v.project_id),
    job_id: pick(v.job_id),
    received_date: v.received_date ?? null,
    due_date: v.due_date ?? null,
    status: v.status,
    notes: v.notes ?? null,
  };
}

export async function createRfq(values: Record<string, string>) {
  let profile;
  try { profile = await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = rfqSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase
    .from("rfqs")
    .insert({ ...rfqPayload(parsed.data), created_by: profile.id });
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { error: null };
}

export async function updateRfq(id: string, values: Record<string, string>) {
  try { await requireEngineer(); } catch (e) { return { error: (e as Error).message }; }
  const parsed = rfqSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const supabase = createClient();
  const { error } = await supabase.from("rfqs").update(rfqPayload(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { error: null };
}

export async function deleteRfq(id: string) {
  const profile = await getProfile();
  if (profile.role_tier < 3) return { error: "Only administrators may delete RFQs." };
  const supabase = createClient();
  const { error } = await supabase
    .from("rfqs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return { error: null };
}

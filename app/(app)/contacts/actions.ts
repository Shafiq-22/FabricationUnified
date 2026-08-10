"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

const ROLES = [
  "project_incharge",
  "requisitioner",
  "procurement",
  "foreman",
  "engineer",
  "inspector",
  "supplier_rep",
  "other",
] as const;

const blank = (v: unknown) => (v === "" || v === undefined ? undefined : v);

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  role: z.enum(ROLES).default("other"),
  organisation: z.preprocess(blank, z.string().optional()),
  email: z.preprocess(blank, z.string().email("Enter a valid email").optional()),
  phone: z.preprocess(blank, z.string().optional()),
  site_id: z.preprocess(blank, z.string().uuid().optional()),
  notes: z.preprocess(blank, z.string().optional()),
});

async function requireEditor() {
  const profile = await getProfile();
  if (profile.role_tier < 2) throw new Error("You do not have permission to edit contacts.");
  return profile;
}

function toRow(d: z.infer<typeof contactSchema>) {
  return {
    name: d.name,
    role: d.role,
    organisation: d.organisation ?? null,
    email: d.email ?? null,
    phone: d.phone ?? null,
    site_id: d.site_id ?? null,
    notes: d.notes ?? null,
  };
}

export async function createContact(values: Record<string, string>) {
  let profileId: string;
  try {
    profileId = (await requireEditor()).id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  const { error } = await supabase
    .from("contacts")
    .insert({ ...toRow(parsed.data), created_by: profileId });
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  revalidatePath("/sites");
  return { error: null };
}

export async function updateContact(id: string, values: Record<string, string>) {
  try {
    await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  const { error } = await supabase.from("contacts").update(toRow(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  revalidatePath("/sites");
  return { error: null };
}

export async function toggleContactActive(id: string, active: boolean) {
  try {
    await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();
  const { error } = await supabase.from("contacts").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  revalidatePath("/sites");
  return { error: null };
}

// ---- Assignments ------------------------------------------------------
const assignmentSchema = z
  .object({
    contact_id: z.string().uuid("Choose a contact"),
    role: z.enum(ROLES).default("other"),
    job_id: z.preprocess(blank, z.string().uuid().optional()),
    project_id: z.preprocess(blank, z.string().uuid().optional()),
    note: z.preprocess(blank, z.string().optional()),
  })
  .refine((d) => d.job_id || d.project_id, {
    message: "Pick the job or project this contact is assigned to.",
  });

export async function assignContact(values: Record<string, string>) {
  let profileId: string;
  try {
    profileId = (await requireEditor()).id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = assignmentSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createClient();
  const { error } = await supabase.from("contact_assignments").insert({
    contact_id: parsed.data.contact_id,
    role: parsed.data.role,
    job_id: parsed.data.job_id ?? null,
    project_id: parsed.data.project_id ?? null,
    note: parsed.data.note ?? null,
    created_by: profileId,
  });
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  return { error: null };
}

export async function removeAssignment(id: string) {
  try {
    await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();
  const { error } = await supabase.from("contact_assignments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  return { error: null };
}

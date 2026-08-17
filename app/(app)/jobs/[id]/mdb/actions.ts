"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canEdit, isAdmin } from "@/lib/types";
import { MDB_CHAPTERS, MDB_STRUCTURAL_PRESET, MDB_TEMPLATE } from "@/lib/mdb/template";

const optStr = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

/**
 * The MDB is a quality record rather than a costing one, so the gate is
 * canEdit (every tier) and not canSeeFinancials. Tier 2 is usually the role
 * that compiles the book.
 */
async function requireEditor() {
  const profile = await getProfile();
  if (!canEdit(profile.role_tier)) throw new Error("You are not allowed to edit the MDB.");
  return profile;
}

function revalidate(jobId: string) {
  revalidatePath(`/jobs/${jobId}/mdb`);
  revalidatePath(`/jobs/${jobId}/worksheet`);
}

/**
 * Create the book for a job and seed it with the standard 52 sections.
 *
 * The header is pre-filled from what the system already knows — job code,
 * description, the project it belongs to, the company letterhead — so the
 * user is confirming details rather than retyping them.
 *
 * `preset: "structural"` marks the sections a typical structural steel job
 * needs as `included` and the rest `not_applicable`; "all" leaves everything
 * `pending` for the user to work through.
 */
export async function createMdb(jobId: string, preset: "structural" | "all" = "structural") {
  let profile;
  try {
    profile = await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("job_mdb")
    .select("id")
    .eq("job_id", jobId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return { error: null, id: existing.id };

  const [{ data: job }, { data: cfgRows }] = await Promise.all([
    supabase
      .from("jobs_view")
      .select("job_code, description, qty, unit, company_job_code, quotation_ref, project_id")
      .eq("id", jobId)
      .maybeSingle(),
    supabase.from("app_config").select("key, value"),
  ]);
  if (!job) return { error: "Job not found." };

  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));

  let projectNumber: string | null = null;
  let projectName: string | null = null;
  if (job.project_id) {
    const { data: project } = await supabase
      .from("projects_view")
      .select("project_code, name")
      .eq("id", job.project_id)
      .maybeSingle();
    projectNumber = project?.project_code ?? null;
    projectName = project?.name ?? null;
  }

  const mdbId = randomUUID();
  const { error: insErr } = await supabase.from("job_mdb").insert({
    id: mdbId,
    job_id: jobId,
    // The job code is the shop's own reference for the item, so it is the
    // sensible default document number until someone overrides it.
    document_no: job.job_code ? `${job.job_code}-MDB` : null,
    revision: "A",
    project_number: projectNumber ?? job.job_code ?? null,
    project_name: projectName,
    customer: null,
    customer_project_number: job.quotation_ref ?? null,
    product: job.description ?? null,
    tag_number: job.company_job_code ?? null,
    product_type: null,
    company_name: cfg.company_name ?? "Six Construct",
    company_address: null,
    created_by: profile.id,
  });
  if (insErr) return { error: insErr.message };

  const rows = MDB_TEMPLATE.map((t, i) => ({
    id: randomUUID(),
    mdb_id: mdbId,
    seq_no: i + 1,
    chapter_no: t.chapter_no,
    chapter_title: MDB_CHAPTERS[t.chapter_no] ?? "",
    section_no: t.section_no,
    section_title: t.section_title,
    code: t.code,
    status:
      preset === "all"
        ? "pending"
        : MDB_STRUCTURAL_PRESET.has(t.section_no)
          ? "included"
          : "not_applicable",
  }));
  const { error: secErr } = await supabase.from("job_mdb_sections").insert(rows);
  if (secErr) {
    // Don't leave a book with no chapters behind.
    await supabase.from("job_mdb").delete().eq("id", mdbId);
    return { error: secErr.message };
  }

  revalidate(jobId);
  return { error: null, id: mdbId };
}

const headerSchema = z.object({
  document_no: optStr,
  revision: optStr,
  project_number: optStr,
  project_name: optStr,
  customer: optStr,
  customer_project_number: optStr,
  product: optStr,
  tag_number: optStr,
  product_type: optStr,
  company_name: optStr,
  company_address: optStr,
  notes: optStr,
});

export async function updateMdbHeader(
  jobId: string,
  mdbId: string,
  values: Record<string, string>,
) {
  try {
    await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = headerSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  const supabase = createClient();
  const { error } = await supabase
    .from("job_mdb")
    .update({
      document_no: v.document_no ?? null,
      revision: v.revision?.trim() || "A",
      project_number: v.project_number ?? null,
      project_name: v.project_name ?? null,
      customer: v.customer ?? null,
      customer_project_number: v.customer_project_number ?? null,
      product: v.product ?? null,
      tag_number: v.tag_number ?? null,
      product_type: v.product_type ?? null,
      company_name: v.company_name ?? null,
      company_address: v.company_address ?? null,
      notes: v.notes ?? null,
    })
    .eq("id", mdbId);
  if (error) return { error: error.message };
  revalidate(jobId);
  return { error: null };
}

/** Nullable columns: clearing the box clears the column. */
const SECTION_NULLABLE = ["doc_reference", "notes", "code"] as const;

/**
 * `status` and `section_title` are NOT NULL, so they are handled apart from
 * the rest: an empty box means "leave that one alone", never "blank it".
 */
type SectionPatch = Partial<Record<(typeof SECTION_NULLABLE)[number], string | null>> & {
  status?: string;
  section_title?: string;
};

/**
 * Patch one section. Only the keys handed in are written, so editing a
 * reference cannot blank the note beside it.
 */
export async function updateMdbSection(
  jobId: string,
  sectionId: string,
  values: Record<string, string>,
) {
  try {
    await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const patch: SectionPatch = {};
  for (const k of SECTION_NULLABLE) {
    if (!(k in values)) continue;
    const raw = (values[k] ?? "").trim();
    patch[k] = raw === "" ? null : raw;
  }
  const status = (values.status ?? "").trim();
  if (status) {
    if (!["included", "pending", "not_applicable"].includes(status)) {
      return { error: "Unknown section status." };
    }
    patch.status = status;
  }
  const title = (values.section_title ?? "").trim();
  if (title) patch.section_title = title;
  if (Object.keys(patch).length === 0) return { error: null };

  const supabase = createClient();
  const { error } = await supabase.from("job_mdb_sections").update(patch).eq("id", sectionId);
  if (error) return { error: error.message };
  revalidate(jobId);
  return { error: null };
}

/** Bulk status change — used by the chapter-level "mark all" controls. */
export async function setMdbSectionStatuses(
  jobId: string,
  sectionIds: string[],
  status: "included" | "pending" | "not_applicable",
) {
  try {
    await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (sectionIds.length === 0) return { error: null };
  const supabase = createClient();
  const { error } = await supabase
    .from("job_mdb_sections")
    .update({ status })
    .in("id", sectionIds);
  if (error) return { error: error.message };
  revalidate(jobId);
  return { error: null };
}

const newSectionSchema = z.object({
  chapter_no: z.string().trim().min(1, "Chapter is required"),
  section_title: z.string().trim().min(1, "Title is required"),
  code: optStr,
});

/**
 * Add a section the standard catalogue does not carry. It is numbered as the
 * next one within its chapter, counting what the job already has rather than
 * what the template defines, so custom sections stack predictably.
 */
export async function addMdbSection(
  jobId: string,
  mdbId: string,
  values: Record<string, string>,
) {
  try {
    await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = newSectionSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  const supabase = createClient();
  const { data: siblings } = await supabase
    .from("job_mdb_sections")
    .select("section_no, seq_no")
    .eq("mdb_id", mdbId)
    .eq("chapter_no", v.chapter_no);

  const highest = (siblings ?? []).reduce((max, s) => {
    const tail = Number(String(s.section_no).split(".")[1] ?? 0);
    return Number.isFinite(tail) && tail > max ? tail : max;
  }, 0);
  const lastSeq = (siblings ?? []).reduce((max, s) => Math.max(max, s.seq_no ?? 0), 0);

  const { error } = await supabase.from("job_mdb_sections").insert({
    mdb_id: mdbId,
    // Sits directly after the chapter's current last section; the book is
    // read in seq_no order, so a custom 4.7 lands with the rest of chapter 4.
    seq_no: lastSeq + 1,
    chapter_no: v.chapter_no,
    chapter_title: MDB_CHAPTERS[v.chapter_no] ?? `Chapter ${v.chapter_no}`,
    section_no: `${v.chapter_no}.${highest + 1}`,
    section_title: v.section_title,
    code: v.code ?? null,
    status: "included",
  });
  if (error) return { error: error.message };
  revalidate(jobId);
  return { error: null };
}

export async function deleteMdbSection(jobId: string, sectionId: string) {
  try {
    await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();
  const { error } = await supabase.from("job_mdb_sections").delete().eq("id", sectionId);
  if (error) return { error: error.message };
  revalidate(jobId);
  return { error: null };
}

/**
 * Attach a document that is already in the Documents module. The MDB does not
 * hold its own copy of anything — it indexes what the job already has, so a
 * document revised in Documents is revised in the book too.
 */
export async function linkMdbDocument(jobId: string, sectionId: string, documentId: string) {
  try {
    await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("job_mdb_section_documents")
    .insert({ section_id: sectionId, document_id: documentId });
  // Linking the same document twice is a no-op, not an error worth showing.
  if (error && error.code !== "23505") return { error: error.message };

  // A section with evidence attached is, by definition, no longer pending.
  const { data: section } = await supabase
    .from("job_mdb_sections")
    .select("status")
    .eq("id", sectionId)
    .maybeSingle();
  if (section?.status === "pending") {
    await supabase.from("job_mdb_sections").update({ status: "included" }).eq("id", sectionId);
  }

  revalidate(jobId);
  return { error: null };
}

export async function unlinkMdbDocument(jobId: string, sectionId: string, documentId: string) {
  try {
    await requireEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("job_mdb_section_documents")
    .delete()
    .eq("section_id", sectionId)
    .eq("document_id", documentId);
  if (error) return { error: error.message };
  revalidate(jobId);
  return { error: null };
}

/** Remove the book entirely. Admin-only, like every other top-level delete. */
export async function deleteMdb(jobId: string, mdbId: string) {
  const profile = await getProfile();
  if (!isAdmin(profile.role_tier)) return { error: "Only administrators may delete the MDB." };
  const supabase = createClient();
  const { error } = await supabase
    .from("job_mdb")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", mdbId);
  if (error) return { error: error.message };
  revalidate(jobId);
  return { error: null };
}

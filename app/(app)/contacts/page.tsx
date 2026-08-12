import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ContactsRegistry } from "@/components/contacts/contacts-registry";
import { ContactsByEntity } from "@/components/contacts/contacts-by-entity";
import { canEdit as canEditTier, isAdmin } from "@/lib/types";
import type {
  Contact,
  ContactAssignment,
  Site,
  ContactGroup,
  WorkforceRow,
} from "@/components/contacts/types";

export const dynamic = "force-dynamic";

type Tab = "registry" | "job" | "project";
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { tab?: Tab };
}) {
  const profile = await getProfile();
  const tab: Tab = searchParams.tab ?? "registry";
  const canEdit = canEditTier(profile.role_tier);
  const supabase = createClient();

  const [
    { data: contacts },
    { data: assignments },
    { data: sites },
    { data: jobs },
    { data: projects },
    { data: workforce },
  ] = await Promise.all([
    supabase.from("contacts").select("*").order("name"),
    supabase.from("contact_assignments").select("*"),
    supabase.from("sites").select("*").order("code"),
    supabase
      .from("jobs_view")
      .select("id, job_code, description, site_code, status, project_id")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("projects_view").select("id, project_code, name, status").order("project_code"),
    supabase.from("job_workforce_contacts").select("*"),
  ]);

  const contactRows = (contacts ?? []) as Contact[];
  const assignmentRows = (assignments ?? []) as ContactAssignment[];
  const siteRows = (sites ?? []) as Site[];
  const jobRows = (jobs ?? []) as any[];
  const projectRows = (projects ?? []) as any[];
  const workforceRows = (workforce ?? []) as WorkforceRow[];

  const contactsById = new Map(contactRows.map((c) => [c.id, c]));
  const siteNames: Record<string, string> = Object.fromEntries(
    siteRows.map((s) => [s.id, `${s.code} — ${s.name}`]),
  );

  // Both views share one shape: a titled group with assigned contacts and
  // the workforce the timesheets say actually worked it.
  let groups: ContactGroup[] = [];

  if (tab === "job") {
    groups = jobRows.map((j) => ({
      id: j.id,
      code: j.job_code ?? "—",
      title: j.description ?? "",
      subtitle: j.site_code ?? "",
      status: j.status ?? null,
      href: `/jobs/${j.id}/worksheet`,
      assigned: assignmentRows
        .filter((a) => a.job_id === j.id)
        .map((a) => ({ ...a, contact: contactsById.get(a.contact_id) ?? null })),
      workforce: workforceRows.filter((w) => w.job_id === j.id),
    }));
  } else if (tab === "project") {
    groups = projectRows.map((p) => {
      const jobIds = jobRows.filter((j) => j.project_id === p.id).map((j) => j.id as string);
      // A project's people = those assigned to the project itself plus
      // everyone assigned to any of its jobs, collapsed so that being
      // attached both ways does not list the same person twice.
      const seen = new Set<string>();
      const assigned = assignmentRows
        .filter((a) => a.project_id === p.id || (a.job_id && jobIds.includes(a.job_id)))
        .filter((a) => {
          const key = `${a.contact_id}:${a.role}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((a) => ({ ...a, contact: contactsById.get(a.contact_id) ?? null }));
      return {
        id: p.id,
        code: p.project_code ?? "—",
        title: p.name ?? "",
        subtitle: `${jobIds.length} job(s)`,
        status: p.status ?? null,
        // Project detail pages land in step C; the list is the target until then.
        href: "/projects",
        assigned,
        workforce: dedupeWorkforce(workforceRows.filter((w) => jobIds.includes(w.job_id ?? ""))),
      };
    });
  }

  const description =
    tab === "registry"
      ? `${contactRows.length} contact(s) across ${siteRows.length} site(s)`
      : tab === "job"
        ? "Everyone attached to each job — assigned contacts plus the crew from the timesheets"
        : "Everyone attached to each project, rolled up from its jobs";

  return (
    <div>
      <PageHeader title="Point of Contact" description={description} />
      <div className="flex gap-1 border-b border-border bg-card px-6">
        <TabLink current={tab} value="registry" label="Registry" />
        <TabLink current={tab} value="job" label="Job Based" />
        <TabLink current={tab} value="project" label="Project Based" />
      </div>

      <div className="p-6">
        {tab === "registry" ? (
          <ContactsRegistry
            contacts={contactRows}
            siteNames={siteNames}
            siteOptions={siteRows
              .filter((s) => s.active)
              .map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
            // Counted separately: a person assigned to a project *and* to a job
            // inside it is two assignments, not two jobs. Lumping them together
            // under a "Jobs" heading read as double-counting.
            jobCounts={countBy(
              assignmentRows.filter((a) => a.job_id),
              (a) => a.contact_id,
            )}
            projectCounts={countBy(
              assignmentRows.filter((a) => a.project_id),
              (a) => a.contact_id,
            )}
            canEdit={canEdit}
            canDelete={isAdmin(profile.role_tier)}
          />
        ) : (
          <ContactsByEntity
            mode={tab}
            groups={groups}
            contactOptions={contactRows
              .filter((c) => c.active)
              .map((c) => ({ value: c.id, label: c.organisation ? `${c.name} — ${c.organisation}` : c.name }))}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}

// One row per person even when they worked several jobs on the project.
function dedupeWorkforce(rows: WorkforceRow[]): WorkforceRow[] {
  const merged = new Map<string, WorkforceRow>();
  for (const r of rows) {
    const key = r.personnel_id ?? r.name ?? "";
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...r });
      continue;
    }
    prev.days_worked = (prev.days_worked ?? 0) + (r.days_worked ?? 0);
    prev.normal_hours = (prev.normal_hours ?? 0) + (r.normal_hours ?? 0);
    prev.ot_hours = (prev.ot_hours ?? 0) + (r.ot_hours ?? 0);
    if ((r.last_worked ?? "") > (prev.last_worked ?? "")) prev.last_worked = r.last_worked;
    if (prev.first_worked && r.first_worked && r.first_worked < prev.first_worked)
      prev.first_worked = r.first_worked;
  }
  return Array.from(merged.values());
}

function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function TabLink({ current, value, label }: { current: Tab; value: Tab; label: string }) {
  const active = current === value;
  return (
    <Link
      href={`/contacts?tab=${value}`}
      className={cn(
        "border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

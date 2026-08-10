"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  HardHat,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { assignContact, removeAssignment } from "@/app/(app)/contacts/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/hooks/use-toast";
import { CONTACT_ROLES, contactRoleLabel, statusMeta } from "@/lib/types";
import type { ContactGroup } from "./types";

export function ContactsByEntity({
  mode,
  groups,
  contactOptions,
  canEdit,
}: {
  mode: "job" | "project";
  groups: ContactGroup[];
  contactOptions: { value: string; label: string }[];
  canEdit: boolean;
}) {
  const [q, setQ] = useState("");
  const [onlyWithPeople, setOnlyWithPeople] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return groups.filter((g) => {
      if (onlyWithPeople && g.assigned.length === 0 && g.workforce.length === 0) return false;
      if (!term) return true;
      const haystack = [
        g.code,
        g.title,
        g.subtitle,
        ...g.assigned.map((a) => a.contact?.name ?? ""),
        ...g.workforce.map((w) => w.name ?? ""),
      ];
      return haystack.some((v) => String(v).toLowerCase().includes(term));
    });
  }, [groups, q, onlyWithPeople]);

  const noun = mode === "job" ? "job" : "project";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${noun} or person…`}
            className="h-8 w-80 pl-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={onlyWithPeople}
              onChange={(e) => setOnlyWithPeople(e.target.checked)}
              className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
            />
            Hide {noun}s with nobody assigned
          </label>
          <span className="text-xs text-muted-foreground">
            {filtered.length} {noun}(s)
          </span>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="border border-border bg-card p-8 text-center text-xs text-muted-foreground">
          Nothing to show. Assign a contact to a {noun}, or untick the filter above to see
          every {noun}.
        </p>
      )}

      {filtered.map((g) => {
        const isOpen = open[g.id] ?? false;
        return (
          <div key={g.id} className="border border-border bg-card">
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [g.id]: !isOpen }))}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="code-chip text-steel">{g.code}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{g.title || "—"}</span>
              {g.subtitle && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {g.subtitle}
                </span>
              )}
              {g.status && (
                <Badge variant={mode === "job" ? statusMeta(g.status).badge : "outline"}>
                  {mode === "job" ? statusMeta(g.status).label : g.status.replace(/_/g, " ")}
                </Badge>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <UserRound className="h-3.5 w-3.5" />
                {g.assigned.length}
                <HardHat className="ml-2 h-3.5 w-3.5" />
                {g.workforce.length}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Link
                    href={g.href}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open {noun} <ExternalLink className="h-3 w-3" />
                  </Link>
                  {canEdit && (
                    <AssignDialog
                      groupId={g.id}
                      mode={mode}
                      contactOptions={contactOptions}
                    />
                  )}
                </div>

                <Section title="Assigned contacts">
                  {g.assigned.length === 0 ? (
                    <Empty>Nobody assigned yet.</Empty>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {g.assigned.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-start justify-between gap-2 border border-border/70 bg-background px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">
                              {a.contact?.name ?? "(deleted contact)"}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {contactRoleLabel(a.role)}
                              {a.contact?.organisation ? ` · ${a.contact.organisation}` : ""}
                            </p>
                            {a.contact?.email && (
                              <a
                                href={`mailto:${a.contact.email}`}
                                className="text-[11px] text-primary hover:underline"
                              >
                                {a.contact.email}
                              </a>
                            )}
                            {a.note && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {a.note}
                              </p>
                            )}
                            {mode === "project" && a.job_id && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                via job
                              </p>
                            )}
                          </div>
                          {canEdit && <RemoveButton id={a.id} />}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="Workforce from timesheets">
                  {g.workforce.length === 0 ? (
                    <Empty>
                      No timesheet entries booked to this {noun} yet.
                    </Empty>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {g.workforce
                        .slice()
                        .sort((a, b) => (b.days_worked ?? 0) - (a.days_worked ?? 0))
                        .map((w) => (
                          <div
                            key={`${g.id}-${w.personnel_id}`}
                            className="border border-border/70 bg-background px-2.5 py-2"
                          >
                            <p className="truncate text-xs font-medium">{w.name}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {w.trade ?? "—"}
                              {w.ho_no ? ` · HO ${w.ho_no}` : ""}
                            </p>
                            <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                              {w.days_worked ?? 0} day(s) ·{" "}
                              {Number(w.normal_hours ?? 0).toFixed(1)} h
                              {Number(w.ot_hours ?? 0) > 0 &&
                                ` + ${Number(w.ot_hours).toFixed(1)} OT`}
                            </p>
                            {w.welder_qualification && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                Qual: {w.welder_qualification}
                                {w.qualification_expiry &&
                                  ` (exp ${w.qualification_expiry})`}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </Section>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function RemoveButton({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await removeAssignment(id);
          if (res.error)
            toast({ variant: "destructive", title: "Failed", description: res.error });
          else router.refresh();
        })
      }
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}

function AssignDialog({
  groupId,
  mode,
  contactOptions,
}: {
  groupId: string;
  mode: "job" | "project";
  contactOptions: { value: string; label: string }[];
}) {
  const fields: FieldDef[] = [
    {
      key: "contact_id",
      label: "Contact",
      type: "select",
      required: true,
      options: contactOptions,
      colSpan: 2,
    },
    {
      key: "role",
      label: "Role on this " + mode,
      type: "select",
      required: true,
      options: CONTACT_ROLES.map((r) => ({ value: r.value, label: r.label })),
      colSpan: 2,
    },
    { key: "note", label: "Note", colSpan: 2 },
  ];

  return (
    <RecordFormDialog
      title={mode === "job" ? "Assign contact to job" : "Assign contact to project"}
      fields={fields}
      initial={{ role: "other" }}
      // The target id travels in the closure — the dialog only renders inputs.
      onSubmit={(v) =>
        assignContact({ ...v, [mode === "job" ? "job_id" : "project_id"]: groupId })
      }
      trigger={
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Plus className="h-3.5 w-3.5" /> Assign contact
        </Button>
      }
    />
  );
}

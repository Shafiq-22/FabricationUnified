"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { updateProject, deleteProject } from "@/app/(app)/projects/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED } from "@/lib/utils";
import { fmtDate } from "@/lib/date";
import { PROJECT_STATUSES, type ProjectView } from "@/lib/types";

export function ProjectsManager({
  rows,
  siteOptions,
  showMoney,
  canEdit,
  canDelete,
}: {
  rows: ProjectView[];
  siteOptions: { value: string; label: string }[];
  showMoney: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const fields: FieldDef[] = [
    { key: "name", label: "Project Name", required: true, colSpan: 2 },
    {
      key: "site_id",
      label: "Site",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...siteOptions],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
      required: true,
    },
    { key: "contract_value", label: "Contract Value (AED)", type: "number", step: "0.01" },
    { key: "start_date", label: "Start Date", type: "date" },
    { key: "target_completion", label: "Target Completion", type: "date" },
    { key: "actual_completion", label: "Actual Completion", type: "date" },
    { key: "notes", label: "Notes", colSpan: 2 },
  ];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((p) =>
      [p.name, p.project_code, p.site_code].some((f) =>
        (f ?? "").toLowerCase().includes(term),
      ),
    );
  }, [q, rows]);

  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: ok });
        router.refresh();
      }
    });

  const badgeFor = (status: string | null) =>
    (PROJECT_STATUSES.find((s) => s.value === status)?.badge ?? "secondary") as
      | "qtn" | "inp" | "com" | "del" | "hal" | "secondary";

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects…"
            className="h-8 w-64 pl-7 text-xs"
          />
        </div>
        {canEdit && (
          <Button size="sm" asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" /> New Project
            </Link>
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Site</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center">Jobs</TableHead>
            {showMoney && <TableHead className="text-center">Quoted</TableHead>}
            {showMoney && <TableHead className="text-center">Actual</TableHead>}
            {showMoney && <TableHead className="text-center">Contract Value</TableHead>}
            <TableHead className="text-center">Target</TableHead>
            {canEdit && <TableHead className="w-20" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={(showMoney ? 11 : 8) - (canEdit ? 0 : 1)}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                {rows.length === 0 ? "No projects yet." : "No projects match that search."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((p) => (
            <TableRow key={p.id ?? ""}>
              <TableCell>
                <Link
                  href={`/projects/${p.id}`}
                  className="code-chip text-steel hover:underline"
                >
                  {p.project_code}
                </Link>
              </TableCell>
              <TableCell className="text-left max-w-[18rem] truncate text-sm">
                <Link href={`/projects/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs" title={p.site_name ?? ""}>
                {p.site_code ?? "—"}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={badgeFor(p.status)}>
                  {PROJECT_STATUSES.find((s) => s.value === p.status)?.label ?? p.status}
                </Badge>
              </TableCell>
              <TableCell className="text-center tabular text-xs">
                {p.job_count ?? 0}
                {(p.completed_job_count ?? 0) > 0 && (
                  <span className="text-muted-foreground"> ({p.completed_job_count} done)</span>
                )}
              </TableCell>
              {showMoney && (
                <TableCell className="text-right tabular text-xs">
                  {formatAED(p.quoted_value)}
                </TableCell>
              )}
              {showMoney && (
                <TableCell className="text-right tabular text-xs">
                  {formatAED(p.actual_value)}
                </TableCell>
              )}
              {showMoney && (
                <TableCell className="text-right tabular text-xs text-muted-foreground">
                  {formatAED(p.contract_value)}
                </TableCell>
              )}
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(p.target_completion)}
              </TableCell>
              {canEdit && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RecordFormDialog
                      title="Edit Project"
                      fields={fields}
                      initial={p as unknown as Record<string, unknown>}
                      onSubmit={(v) => updateProject(p.id ?? "", v)}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Delete project "${p.name}"?`))
                            run(() => deleteProject(p.id ?? ""), "Deleted");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

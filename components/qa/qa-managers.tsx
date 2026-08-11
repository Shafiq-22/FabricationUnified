"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createInspection,
  updateInspection,
  deleteInspection,
  createNcr,
  updateNcr,
  deleteNcr,
} from "@/app/(app)/qa/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
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
import { fmtDate } from "@/lib/date";
import {
  INSPECTION_RESULTS,
  NCR_STATUSES,
  NCR_SEVERITIES,
  type InspectionReport,
  type Ncr,
} from "@/lib/types";

type BadgeVariant = "qtn" | "inp" | "com" | "del" | "hal" | "secondary";

function useRun() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: ok });
        router.refresh();
      }
    });
  return { run, pending };
}

export function InspectionsManager({
  rows,
  jobOptions,
  jobCodes,
  inspectorOptions,
  inspectorNames,
  canEdit,
  canDelete,
}: {
  rows: InspectionReport[];
  jobOptions: { value: string; label: string }[];
  jobCodes: Record<string, string>;
  inspectorOptions: { value: string; label: string }[];
  inspectorNames: Record<string, string>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { run, pending } = useRun();

  const fields: FieldDef[] = [
    {
      key: "job_id",
      label: "Job",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...jobOptions],
      colSpan: 2,
    },
    { key: "item_ref", label: "Item / Mark No" },
    {
      key: "result",
      label: "Result",
      type: "select",
      options: INSPECTION_RESULTS.map((r) => ({ value: r.value, label: r.label })),
      required: true,
    },
    {
      key: "inspector_id",
      label: "Inspector",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...inspectorOptions],
    },
    { key: "inspected_at", label: "Inspected On", type: "date" },
    { key: "notes", label: "Notes", colSpan: 2 },
  ];

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-2">
        <p className="px-2 text-xs text-muted-foreground">
          Weld / dimensional inspection results — every change is captured in the audit log.
        </p>
        {canEdit && (
          <RecordFormDialog
            title="New Inspection"
            fields={fields}
            onSubmit={createInspection}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> New Inspection
              </Button>
            }
          />
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Inspector</TableHead>
            <TableHead>Notes</TableHead>
            {canEdit && <TableHead className="w-20" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canEdit ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">
                No inspections recorded yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(r.inspected_at)}
              </TableCell>
              <TableCell className="code-chip text-steel">
                {r.job_id ? jobCodes[r.job_id] ?? "—" : "—"}
              </TableCell>
              <TableCell className="text-xs">{r.item_ref ?? "—"}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    (INSPECTION_RESULTS.find((x) => x.value === r.result)?.badge ??
                      "secondary") as BadgeVariant
                  }
                >
                  {INSPECTION_RESULTS.find((x) => x.value === r.result)?.label ?? r.result}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {r.inspector_id ? inspectorNames[r.inspector_id] ?? "—" : "—"}
              </TableCell>
              <TableCell className="text-left max-w-[18rem] truncate text-xs text-muted-foreground">
                {r.notes ?? "—"}
              </TableCell>
              {canEdit && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RecordFormDialog
                      title="Edit Inspection"
                      fields={fields}
                      initial={r as unknown as Record<string, unknown>}
                      onSubmit={(v) => updateInspection(r.id, v)}
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
                          if (confirm("Delete this inspection?"))
                            run(() => deleteInspection(r.id), "Deleted");
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

export function NcrsManager({
  rows,
  jobOptions,
  jobCodes,
  projectOptions,
  canEdit,
  canDelete,
}: {
  rows: Ncr[];
  jobOptions: { value: string; label: string }[];
  jobCodes: Record<string, string>;
  projectOptions: { value: string; label: string }[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { run, pending } = useRun();

  const fields: FieldDef[] = [
    { key: "title", label: "Title", required: true, colSpan: 2 },
    {
      key: "job_id",
      label: "Job",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...jobOptions],
    },
    {
      key: "project_id",
      label: "Project",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...projectOptions],
    },
    { key: "item_ref", label: "Item / Mark No" },
    {
      key: "severity",
      label: "Severity",
      type: "select",
      options: NCR_SEVERITIES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })),
      required: true,
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: NCR_STATUSES.map((s) => ({ value: s.value, label: s.label })),
      required: true,
    },
    { key: "description", label: "Description", colSpan: 2 },
    { key: "root_cause", label: "Root Cause", colSpan: 2 },
    { key: "corrective_action", label: "Corrective Action", colSpan: 2 },
  ];

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-2">
        <p className="px-2 text-xs text-muted-foreground">
          Non-conformance reports. Closing an NCR stamps the closure time automatically.
        </p>
        {canEdit && (
          <RecordFormDialog
            title="New NCR"
            fields={fields}
            onSubmit={createNcr}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> New NCR
              </Button>
            }
          />
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Raised</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Closed</TableHead>
            {canEdit && <TableHead className="w-20" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canEdit ? 8 : 7} className="py-10 text-center text-sm text-muted-foreground">
                No NCRs raised.
              </TableCell>
            </TableRow>
          )}
          {rows.map((n) => (
            <TableRow key={n.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(n.raised_at)}
              </TableCell>
              <TableCell className="text-left max-w-[18rem] truncate text-sm">{n.title}</TableCell>
              <TableCell className="code-chip text-steel">
                {n.job_id ? jobCodes[n.job_id] ?? "—" : "—"}
              </TableCell>
              <TableCell className="text-xs">{n.item_ref ?? "—"}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    n.severity === "critical" ? "hal" : n.severity === "major" ? "inp" : "secondary"
                  }
                >
                  {n.severity ?? "minor"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    (NCR_STATUSES.find((s) => s.value === n.status)?.badge ??
                      "secondary") as BadgeVariant
                  }
                >
                  {NCR_STATUSES.find((s) => s.value === n.status)?.label ?? n.status}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {n.closed_at ? fmtDate(n.closed_at) : "—"}
              </TableCell>
              {canEdit && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RecordFormDialog
                      title="Edit NCR"
                      fields={fields}
                      initial={n as unknown as Record<string, unknown>}
                      onSubmit={(v) => updateNcr(n.id, v)}
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
                          if (confirm("Delete this NCR?")) run(() => deleteNcr(n.id), "Deleted");
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

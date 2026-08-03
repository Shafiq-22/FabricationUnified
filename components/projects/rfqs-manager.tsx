"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { createRfq, updateRfq, deleteRfq } from "@/app/(app)/projects/actions";
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
import { fmtDate, daysBetween } from "@/lib/date";
import { RFQ_STATUSES, type Rfq } from "@/lib/types";

export function RfqsManager({
  rows,
  clientOptions,
  projectOptions,
  jobOptions,
  clientNames,
  projectCodes,
  canEdit,
  canDelete,
}: {
  rows: Rfq[];
  clientOptions: { value: string; label: string }[];
  projectOptions: { value: string; label: string }[];
  jobOptions: { value: string; label: string }[];
  clientNames: Record<string, string>;
  projectCodes: Record<string, string>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const fields: FieldDef[] = [
    { key: "title", label: "RFQ Title", required: true, colSpan: 2 },
    {
      key: "client_id",
      label: "Client",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...clientOptions],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: RFQ_STATUSES.map((s) => ({ value: s.value, label: s.label })),
      required: true,
    },
    {
      key: "project_id",
      label: "Project",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...projectOptions],
    },
    {
      key: "job_id",
      label: "Job",
      type: "select",
      options: [{ value: "none", label: "— None —" }, ...jobOptions],
    },
    { key: "received_date", label: "Received", type: "date" },
    { key: "due_date", label: "Due", type: "date" },
    { key: "notes", label: "Notes", colSpan: 2 },
  ];

  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: ok });
        router.refresh();
      }
    });

  const today = new Date().toISOString().slice(0, 10);
  const badgeFor = (s: string | null) =>
    (RFQ_STATUSES.find((x) => x.value === s)?.badge ?? "secondary") as
      | "qtn" | "inp" | "com" | "del" | "hal" | "secondary";

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-2">
        <p className="px-2 text-xs text-muted-foreground">
          Enquiries received, with due-date tracking so quote turnaround is measurable.
        </p>
        {canEdit && (
          <RecordFormDialog
            title="New RFQ"
            fields={fields}
            onSubmit={createRfq}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> New RFQ
              </Button>
            }
          />
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
            {canEdit && <TableHead className="w-20" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canEdit ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">
                No RFQs recorded yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => {
            const overdue =
              r.due_date != null && r.due_date < today && ["open", "quoted"].includes(r.status);
            const daysLeft = r.due_date ? daysBetween(today, r.due_date) : null;
            return (
              <TableRow key={r.id}>
                <TableCell className="max-w-[20rem] truncate text-sm">{r.title}</TableCell>
                <TableCell className="text-xs">
                  {r.client_id ? clientNames[r.client_id] ?? "—" : "—"}
                </TableCell>
                <TableCell className="code-chip text-steel">
                  {r.project_id ? projectCodes[r.project_id] ?? "—" : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {fmtDate(r.received_date)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  <span className={overdue ? "font-semibold text-destructive" : "text-muted-foreground"}>
                    {overdue && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                    {fmtDate(r.due_date)}
                    {!overdue && daysLeft != null && daysLeft >= 0 && r.status === "open" && (
                      <span className="ml-1 text-muted-foreground/70">({daysLeft}d)</span>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={badgeFor(r.status)}>
                    {RFQ_STATUSES.find((s) => s.value === r.status)?.label ?? r.status}
                  </Badge>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <RecordFormDialog
                        title="Edit RFQ"
                        fields={fields}
                        initial={r as unknown as Record<string, unknown>}
                        onSubmit={(v) => updateRfq(r.id, v)}
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
                            if (confirm("Delete this RFQ?")) run(() => deleteRfq(r.id), "Deleted");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

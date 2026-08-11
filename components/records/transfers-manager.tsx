"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  createTransfer,
  updateTransfer,
  setTransferStatus,
  deleteTransfer,
} from "@/app/(app)/records/transfers-actions";
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
import { fmtDate } from "@/lib/date";

export interface TransferRow {
  id: string;
  personnel_id: string;
  from_site_id: string | null;
  to_site_id: string | null;
  requested_on: string;
  effective_on: string | null;
  status: string;
  reason: string | null;
  notes: string | null;
}

const STATUSES = [
  { value: "requested", label: "Requested", badge: "qtn" },
  { value: "approved", label: "Approved", badge: "inp" },
  { value: "completed", label: "Completed", badge: "com" },
  { value: "rejected", label: "Rejected", badge: "hal" },
  { value: "cancelled", label: "Cancelled", badge: "secondary" },
] as const;

export function TransfersManager({
  rows,
  personnelNames,
  personnelOptions,
  siteNames,
  siteOptions,
  canEdit,
  canDelete,
}: {
  rows: TransferRow[];
  personnelNames: Record<string, string>;
  personnelOptions: { value: string; label: string }[];
  siteNames: Record<string, string>;
  siteOptions: { value: string; label: string }[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const fields: FieldDef[] = useMemo(
    () => [
      {
        key: "personnel_id",
        label: "Who is being transferred",
        type: "select",
        options: personnelOptions,
        required: true,
        colSpan: 2,
      },
      {
        key: "from_site_id",
        label: "From site",
        type: "select",
        options: [{ value: "none", label: "— Current site —" }, ...siteOptions],
      },
      {
        key: "to_site_id",
        label: "To site",
        type: "select",
        options: [{ value: "none", label: "— Unassigned —" }, ...siteOptions],
      },
      { key: "requested_on", label: "Requested On", type: "date" },
      { key: "effective_on", label: "Effective On", type: "date" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: STATUSES.map((s) => ({ value: s.value, label: s.label })),
        required: true,
      },
      { key: "reason", label: "Reason", colSpan: 2 },
      { key: "notes", label: "Notes", colSpan: 2 },
    ],
    [personnelOptions, siteOptions],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [
        personnelNames[r.personnel_id],
        siteNames[r.from_site_id ?? ""],
        siteNames[r.to_site_id ?? ""],
        r.reason,
        r.status,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [rows, q, personnelNames, siteNames]);

  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: ok });
        router.refresh();
      }
    });

  const meta = (status: string) =>
    STATUSES.find((s) => s.value === status) ?? STATUSES[0];

  return (
    <section className="border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Transfers ({rows.length})
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or site…"
              className="h-8 w-60 pl-7 text-xs"
            />
          </div>
          {canEdit && (
            <RecordFormDialog
              title="Request Transfer"
              fields={fields}
              initial={{ status: "requested", requested_on: new Date().toISOString().slice(0, 10) }}
              onSubmit={createTransfer}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Request Transfer
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>From</TableHead>
            <TableHead className="w-8" />
            <TableHead>To</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Effective</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="w-28">Status</TableHead>
            {canEdit && <TableHead className="w-48" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={canEdit ? 9 : 8}
                className="py-10 text-center text-xs text-muted-foreground"
              >
                {rows.length === 0
                  ? "No transfers raised. Use Request Transfer to move someone between sites."
                  : "No transfers match that search."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((r) => {
            const m = meta(r.status);
            return (
              <TableRow key={r.id}>
                <TableCell className="text-sm font-medium">
                  {personnelNames[r.personnel_id] ?? "—"}
                </TableCell>
                <TableCell className="text-center font-mono text-xs">
                  {r.from_site_id ? siteNames[r.from_site_id] ?? "—" : "—"}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  <ArrowRight className="mx-auto h-3.5 w-3.5" />
                </TableCell>
                <TableCell className="text-center font-mono text-xs">
                  {r.to_site_id ? siteNames[r.to_site_id] ?? "—" : "—"}
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">
                  {fmtDate(r.requested_on)}
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">
                  {fmtDate(r.effective_on)}
                </TableCell>
                <TableCell className="text-left max-w-[16rem] truncate text-xs">{r.reason ?? "—"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={m.badge}>{m.label}</Badge>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {r.status === "requested" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={pending}
                            onClick={() => run(() => setTransferStatus(r.id, "approved"), "Approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            disabled={pending}
                            onClick={() => run(() => setTransferStatus(r.id, "rejected"), "Rejected")}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {r.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={pending}
                          title="Marks the transfer done and moves the person to the new site"
                          onClick={() => run(() => setTransferStatus(r.id, "completed"), "Transfer completed")}
                        >
                          Complete
                        </Button>
                      )}
                      <RecordFormDialog
                        title="Edit Transfer"
                        fields={fields}
                        initial={r as unknown as Record<string, unknown>}
                        onSubmit={(v) => updateTransfer(r.id, v)}
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
                            if (confirm("Delete this transfer record?"))
                              run(() => deleteTransfer(r.id), "Deleted");
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
    </section>
  );
}

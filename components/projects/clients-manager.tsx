"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import {
  createClientRecord,
  updateClientRecord,
  toggleClientActive,
  deleteClientRecord,
} from "@/app/(app)/projects/actions";
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
import type { Client } from "@/lib/types";

const fields: FieldDef[] = [
  { key: "name", label: "Client Name", required: true, colSpan: 2 },
  { key: "contact_name", label: "Contact Name" },
  { key: "contact_email", label: "Contact Email" },
  { key: "contact_phone", label: "Contact Phone" },
  { key: "address", label: "Address", colSpan: 2 },
];

export function ClientsManager({
  rows,
  projectCounts,
  canEdit,
  canDelete,
}: {
  rows: Client[];
  projectCounts: Record<string, number>;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((c) =>
      [c.name, c.contact_name, c.contact_email].some((f) =>
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

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients…"
            className="h-8 w-64 pl-7 text-xs"
          />
        </div>
        {canEdit && (
          <RecordFormDialog
            title="Add Client"
            fields={fields}
            onSubmit={createClientRecord}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Add Client
              </Button>
            }
          />
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Projects</TableHead>
            <TableHead className="w-24">Status</TableHead>
            {canEdit && <TableHead className="w-28" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={canEdit ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">
                {rows.length === 0 ? "No clients yet." : "No clients match that search."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="text-sm font-medium">{c.name}</TableCell>
              <TableCell className="text-xs">{c.contact_name ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{c.contact_email ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{c.contact_phone ?? "—"}</TableCell>
              <TableCell className="text-right tabular text-xs">{projectCounts[c.id] ?? 0}</TableCell>
              <TableCell>
                {c.active ? <Badge variant="com">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
              </TableCell>
              {canEdit && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RecordFormDialog
                      title="Edit Client"
                      fields={fields}
                      initial={c as unknown as Record<string, unknown>}
                      onSubmit={(v) => updateClientRecord(c.id, v)}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={pending}
                      onClick={() => run(() => toggleClientActive(c.id, !c.active), "Updated")}
                    >
                      {c.active ? "Deactivate" : "Activate"}
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Delete client "${c.name}"?`))
                            run(() => deleteClientRecord(c.id), "Deleted");
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

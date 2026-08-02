"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import {
  createSupplier,
  updateSupplier,
  toggleSupplier,
  deleteSupplier,
} from "@/app/(app)/procurement/supplier-actions";
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
import type { Supplier } from "@/lib/types";

const fields: FieldDef[] = [
  { key: "name", label: "Supplier Name", required: true, colSpan: 2 },
  { key: "category", label: "Category", placeholder: "steel / consumables / paint / transport" },
  { key: "contact_name", label: "Contact Name" },
  { key: "contact_email", label: "Contact Email" },
  { key: "contact_phone", label: "Contact Phone" },
];

export function SuppliersManager({
  rows,
  canDelete,
  usageCounts,
}: {
  rows: Supplier[];
  canDelete: boolean;
  usageCounts: Record<string, number>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.category ?? "").toLowerCase().includes(term) ||
        (s.contact_name ?? "").toLowerCase().includes(term),
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
            placeholder="Search suppliers…"
            className="h-8 w-64 pl-7 text-xs"
          />
        </div>
        <RecordFormDialog
          title="Add Supplier"
          fields={fields}
          onSubmit={createSupplier}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" /> Add Supplier
            </Button>
          }
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Records</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                {rows.length === 0
                  ? "No suppliers yet — add one, or they appear automatically from existing procurement records."
                  : "No suppliers match that search."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-sm font-medium">{s.name}</TableCell>
              <TableCell className="text-xs">{s.category ?? "—"}</TableCell>
              <TableCell className="text-xs">{s.contact_name ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{s.contact_email ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{s.contact_phone ?? "—"}</TableCell>
              <TableCell className="text-right tabular text-xs">{usageCounts[s.id] ?? 0}</TableCell>
              <TableCell>
                {s.active ? <Badge variant="com">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <RecordFormDialog
                    title="Edit Supplier"
                    fields={fields}
                    initial={s as unknown as Record<string, unknown>}
                    onSubmit={(v) => updateSupplier(s.id, v)}
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
                    onClick={() => run(() => toggleSupplier(s.id, !s.active), "Updated")}
                  >
                    {s.active ? "Deactivate" : "Activate"}
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`Delete supplier "${s.name}"?`))
                          run(() => deleteSupplier(s.id), "Deleted");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

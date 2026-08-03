"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  addPersonnel, updatePersonnel, togglePersonnel, deletePersonnel,
  addEquipment, updateEquipment, toggleEquipment, deleteEquipment,
} from "@/app/(app)/records/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED } from "@/lib/utils";
import type { Personnel, Equipment } from "@/lib/types";

const personFields: FieldDef[] = [
  { key: "ho_no", label: "HO No" },
  { key: "name", label: "Name", required: true },
  { key: "trade", label: "Trade", colSpan: 2, placeholder: "Welder / Weld-FM / Weld-GL…" },
  { key: "welder_qualification", label: "Welder Qualification", placeholder: "e.g. ISO 9606-1 141" },
  { key: "qualification_expiry", label: "Qualification Expiry", type: "date" },
];
const equipFields: FieldDef[] = [
  { key: "sixco_no", label: "Sixco No" },
  { key: "device_group", label: "Device Group" },
  { key: "machine", label: "Machine", required: true, colSpan: 2 },
  { key: "make", label: "Make" },
  { key: "type", label: "Type" },
  { key: "bare_rate", label: "Bare Rate (AED/day)", type: "number", step: "0.01" },
  { key: "driver_rate", label: "Driver Rate (AED/day)", type: "number", step: "0.01" },
];

function useRun() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else { toast({ title: ok }); router.refresh(); }
    });
  return { run, pending };
}

export function PersonnelManager({ rows, canDelete }: { rows: Personnel[]; canDelete: boolean }) {
  const { run, pending } = useRun();
  return (
    <section className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personnel ({rows.length})</h2>
        <RecordFormDialog title="Add Personnel" fields={personFields} onSubmit={addPersonnel}
          trigger={<Button size="sm"><Plus className="h-4 w-4" /> Add Personnel</Button>} />
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead className="w-28">HO No</TableHead><TableHead>Name</TableHead>
          <TableHead>Trade</TableHead><TableHead>Qualification</TableHead>
          <TableHead className="w-24">Status</TableHead><TableHead className="w-28" />
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No personnel yet — add some.</TableCell></TableRow>}
          {rows.map((p) => {
            const expired =
              p.qualification_expiry != null &&
              p.qualification_expiry < new Date().toISOString().slice(0, 10);
            return (
            <TableRow key={p.id}>
              <TableCell className="code-chip">{p.ho_no}</TableCell>
              <TableCell className="text-sm">{p.name}</TableCell>
              <TableCell className="text-xs">{p.trade}</TableCell>
              <TableCell className="text-xs">
                {p.welder_qualification ? (
                  <span className={expired ? "font-semibold text-destructive" : ""}>
                    {p.welder_qualification}
                    {p.qualification_expiry && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {expired ? "(expired " : "(exp "}
                        {p.qualification_expiry})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>{p.active ? <Badge variant="com">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <RecordFormDialog title="Edit Personnel" fields={personFields} initial={p as unknown as Record<string, unknown>}
                    onSubmit={(v) => updatePersonnel(p.id, v)}
                    trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                  <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={pending}
                    onClick={() => run(() => togglePersonnel(p.id, !p.active), "Updated")}>
                    {p.active ? "Deactivate" : "Activate"}
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={pending}
                      onClick={() => { if (confirm("Delete this person? Their timesheet entries are removed too.")) run(() => deletePersonnel(p.id), "Deleted"); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}

export function EquipmentManager({ rows, canDelete }: { rows: Equipment[]; canDelete: boolean }) {
  const { run, pending } = useRun();
  return (
    <section className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Equipment ({rows.length})</h2>
        <RecordFormDialog title="Add Equipment" fields={equipFields} onSubmit={addEquipment}
          trigger={<Button size="sm"><Plus className="h-4 w-4" /> Add Equipment</Button>} />
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead className="w-24">Sixco No</TableHead><TableHead className="w-20">Group</TableHead>
          <TableHead>Machine</TableHead><TableHead>Make</TableHead><TableHead>Type</TableHead>
          <TableHead className="text-right">Bare</TableHead><TableHead className="text-right">Driver</TableHead>
          <TableHead className="w-24">Status</TableHead><TableHead className="w-28" />
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">No equipment yet — add some.</TableCell></TableRow>}
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="code-chip">{e.sixco_no}</TableCell>
              <TableCell className="font-mono text-xs">{e.device_group}</TableCell>
              <TableCell className="text-xs">{e.machine}</TableCell>
              <TableCell className="text-xs">{e.make}</TableCell>
              <TableCell className="text-xs">{e.type}</TableCell>
              <TableCell className="text-right tabular text-xs">{formatAED(e.bare_rate)}</TableCell>
              <TableCell className="text-right tabular text-xs">{formatAED(e.driver_rate)}</TableCell>
              <TableCell>{e.active ? <Badge variant="com">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <RecordFormDialog title="Edit Equipment" fields={equipFields} initial={e as unknown as Record<string, unknown>}
                    onSubmit={(v) => updateEquipment(e.id, v)}
                    trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                  <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={pending}
                    onClick={() => run(() => toggleEquipment(e.id, !e.active), "Updated")}>
                    {e.active ? "Deactivate" : "Activate"}
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={pending}
                      onClick={() => { if (confirm("Delete this equipment? Its usage records are removed too.")) run(() => deleteEquipment(e.id), "Deleted"); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

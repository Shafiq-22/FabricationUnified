"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Save } from "lucide-react";
import {
  updateRoleName,
  updateCompanyConfig,
  addLabourRate,
  updateLabourRate,
  toggleLabourRate,
} from "@/app/(app)/settings/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { RoleConfig, LabourRate } from "@/lib/types";

const rateFields: FieldDef[] = [
  { key: "designation", label: "Designation", required: true, colSpan: 2 },
  { key: "rate_aed_per_hr", label: "Rate (AED / hr)", type: "number", step: "0.01", required: true },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-card">
      <h2 className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SettingsClient({
  roles,
  company,
  department,
  rates,
}: {
  roles: RoleConfig[];
  company: string;
  department: string;
  rates: LabourRate[];
}) {
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Role Display Names">
        <div className="space-y-3">
          {roles
            .sort((a, b) => a.tier - b.tier)
            .map((r) => (
              <RoleRow key={r.tier} role={r} onSave={(name) => run(() => updateRoleName(r.tier, name), "Role name saved")} pending={pending} />
            ))}
        </div>
      </Card>

      <Card title="Company / Department (PDF header)">
        <CompanyForm
          company={company}
          department={department}
          onSave={(c, d) => run(() => updateCompanyConfig(c, d), "Saved")}
          pending={pending}
        />
      </Card>

      <div className="lg:col-span-2">
        <Card title="Labour Rates">
          <div className="mb-3 flex justify-end">
            <RecordFormDialog
              title="New Labour Rate"
              fields={rateFields}
              onSubmit={addLabourRate}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Add Rate
                </Button>
              }
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Designation</TableHead>
                <TableHead className="text-right">Rate (AED/hr)</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rt) => (
                <TableRow key={rt.id}>
                  <TableCell className="text-sm">{rt.designation}</TableCell>
                  <TableCell className="text-right tabular">{formatAED(rt.rate_aed_per_hr)}</TableCell>
                  <TableCell>
                    {rt.active ? (
                      <Badge variant="com">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <RecordFormDialog
                        title="Edit Labour Rate"
                        fields={rateFields}
                        initial={rt as unknown as Record<string, unknown>}
                        onSubmit={(v) => updateLabourRate(rt.id, v)}
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
                        onClick={() => run(() => toggleLabourRate(rt.id, !rt.active), "Updated")}
                      >
                        {rt.active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function RoleRow({
  role,
  onSave,
  pending,
}: {
  role: RoleConfig;
  onSave: (name: string) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(role.display_name);
  return (
    <div className="flex items-end gap-2">
      <Badge variant="outline" className="mb-1.5">
        Tier {role.tier}
      </Badge>
      <div className="flex-1 space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Display name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="mb-0.5"
        disabled={pending || name === role.display_name}
        onClick={() => onSave(name)}
      >
        <Save className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function CompanyForm({
  company,
  department,
  onSave,
  pending,
}: {
  company: string;
  department: string;
  onSave: (c: string, d: string) => void;
  pending: boolean;
}) {
  const [c, setC] = useState(company);
  const [d, setD] = useState(department);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Company Name</Label>
        <Input value={c} onChange={(e) => setC(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Department Name</Label>
        <Input value={d} onChange={(e) => setD(e.target.value)} className="h-8 text-sm" />
      </div>
      <Button size="sm" disabled={pending} onClick={() => onSave(c, d)}>
        <Save className="h-3.5 w-3.5" /> Save
      </Button>
    </div>
  );
}

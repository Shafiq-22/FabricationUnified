"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Save, Trash2 } from "lucide-react";
import {
  updateRoleName,
  updateCompanyConfig,
  updateMargins,
  updateTimesheetRates,
  changeMyPassword,
  addLabourRate,
  updateLabourRate,
  toggleLabourRate,
  deleteLabourRate,
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
  { key: "rate_aed_per_hr", label: "Normal Rate (AED / hr)", type: "number", step: "0.01", required: true },
  { key: "ot_rate_aed_per_hr", label: "Overtime Rate (AED / hr)", type: "number", step: "0.01" },
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
  margins,
  timesheetRates,
  inflationPct,
  certWarnDays,
  certNotifyEmail,
}: {
  roles: RoleConfig[];
  company: string;
  department: string;
  rates: LabourRate[];
  margins: { material: number; workforce: number; consumables: number };
  timesheetRates: { normal: number; ot: number };
  inflationPct: number;
  certWarnDays: number;
  certNotifyEmail: string;
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

      <Card title="Section Margins (%)">
        <MarginsForm
          margins={margins}
          pending={pending}
          onSave={(v) => run(() => updateMargins(v), "Margins saved — jobs recomputed")}
        />
      </Card>

      <Card title="Timesheet Rates (AED/hr)">
        <TimesheetRatesForm
          rates={timesheetRates}
          inflationPct={inflationPct}
          certWarnDays={certWarnDays}
          certNotifyEmail={certNotifyEmail}
          pending={pending}
          onSave={(v) => run(() => updateTimesheetRates(v), "Timesheet rates saved")}
        />
      </Card>

      <Card title="Change My Password">
        <PasswordForm />
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
                <TableHead>Normal (AED/hr)</TableHead>
                <TableHead>Overtime (AED/hr)</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rt) => (
                <TableRow key={rt.id}>
                  <TableCell className="text-sm">{rt.designation}</TableCell>
                  <TableCell className="text-right tabular">{formatAED(rt.rate_aed_per_hr)}</TableCell>
                  <TableCell className="text-right tabular">
                    {rt.ot_rate_aed_per_hr == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      formatAED(rt.ot_rate_aed_per_hr)
                    )}
                  </TableCell>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        title="Delete trade rate"
                        onClick={() => {
                          if (confirm(`Delete the "${rt.designation}" rate? Timesheets already costed keep their figures.`))
                            run(() => deleteLabourRate(rt.id), "Deleted");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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

function MarginsForm({
  margins,
  onSave,
  pending,
}: {
  margins: { material: number; workforce: number; consumables: number };
  onSave: (v: Record<string, string>) => void;
  pending: boolean;
}) {
  const [m, setM] = useState(String(margins.material));
  const [w, setW] = useState(String(margins.workforce));
  const [c, setC] = useState(String(margins.consumables));
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Applied to every job&apos;s quote: section Total = Sub-total × (1 + margin %).
        Saving recomputes all jobs.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Material</Label>
          <Input type="number" step="0.1" value={m} onChange={(e) => setM(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Workforce</Label>
          <Input type="number" step="0.1" value={w} onChange={(e) => setW(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Consumables</Label>
          <Input type="number" step="0.1" value={c} onChange={(e) => setC(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() => onSave({ material_margin: m, workforce_margin: w, consumables_margin: c })}
      >
        <Save className="h-3.5 w-3.5" /> Save Margins
      </Button>
    </div>
  );
}

function TimesheetRatesForm({
  rates,
  inflationPct,
  certWarnDays,
  certNotifyEmail,
  onSave,
  pending,
}: {
  rates: { normal: number; ot: number };
  inflationPct: number;
  certWarnDays: number;
  certNotifyEmail: string;
  onSave: (v: Record<string, string>) => void;
  pending: boolean;
}) {
  const [n, setN] = useState(String(rates.normal));
  const [o, setO] = useState(String(rates.ot));
  const [inf, setInf] = useState(String(inflationPct));
  const [certDays, setCertDays] = useState(String(certWarnDays));
  const [certEmail, setCertEmail] = useState(certNotifyEmail);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[10px] uppercase text-muted-foreground">
          Yearly inflation (%)
        </Label>
        <Input
          type="number"
          step="0.1"
          value={inf}
          onChange={(e) => setInf(e.target.value)}
          className="h-8 w-28 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Ages historic purchase prices forward in tentative quoting, compounded by
          how old each price is. Prices under a month old are used as they stand.
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-[10px] uppercase text-muted-foreground">
          Welder certificate reminder
        </Label>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Days ahead</Label>
            <Input
              type="number"
              min="1"
              value={certDays}
              onChange={(e) => setCertDays(e.target.value)}
              className="h-8 w-24 text-sm"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Notify</Label>
            <Input
              type="email"
              value={certEmail}
              onChange={(e) => setCertEmail(e.target.value)}
              placeholder="who to warn about an expiring ticket"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          How far ahead a certificate counts as expiring, and the address the
          drafted reminder is addressed to.
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Fallback timesheet rates, used only for a designation that has no rate of
          its own in Labour Rates above.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Normal</Label>
            <Input type="number" step="0.01" value={n} onChange={(e) => setN(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Overtime</Label>
            <Input type="number" step="0.01" value={o} onChange={(e) => setO(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      </div>

      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          onSave({
            timesheet_normal_rate: n,
            timesheet_ot_rate: o,
            inflation_rate_pct: inf,
            cert_expiry_warn_days: certDays,
            cert_expiry_notify_email: certEmail,
          })
        }
      >
        <Save className="h-3.5 w-3.5" /> Save
      </Button>
    </div>
  );
}

function PasswordForm() {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  const submit = () => {
    if (pw.length < 8) {
      toast({ variant: "destructive", title: "Too short", description: "Minimum 8 characters." });
      return;
    }
    if (pw !== confirm) {
      toast({ variant: "destructive", title: "Mismatch", description: "Passwords do not match." });
      return;
    }
    start(async () => {
      const res = await changeMyPassword(pw);
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: "Password changed" });
        setPw("");
        setConfirm("");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">New Password</Label>
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-8 text-sm" autoComplete="new-password" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Confirm Password</Label>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-8 text-sm" autoComplete="new-password" />
      </div>
      <Button size="sm" disabled={pending} onClick={submit}>
        <Save className="h-3.5 w-3.5" /> Update Password
      </Button>
    </div>
  );
}

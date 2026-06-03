"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { EditableTable } from "@/components/jobs/editable-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/hooks/use-toast";
import { formatAED, formatPercent } from "@/lib/utils";
import { replaceJobLines, type Row } from "@/app/(app)/jobs/[id]/worksheet/actions";
import { updateJobDetails } from "@/app/(app)/jobs/actions";
import type {
  JobView,
  QuoteMaterial,
  QuoteWorkforce,
  QuotationSummary,
  ActualMaterial,
  ActualWorkforce,
  ActualSummary,
} from "@/lib/types";

const matCols = [
  { key: "material_name", label: "Material", type: "text" as const },
  { key: "unit", label: "Unit", type: "text" as const },
  { key: "qty", label: "Qty", type: "number" as const, align: "right" as const, step: "0.01" },
  { key: "unit_cost", label: "Unit Cost", type: "number" as const, align: "right" as const, step: "0.01" },
];
const wfCols = [
  { key: "designation", label: "Designation", type: "text" as const },
  { key: "qty", label: "Qty", type: "number" as const, align: "right" as const, step: "1" },
  { key: "hrs_per_person", label: "Hrs/Person", type: "number" as const, align: "right" as const, step: "0.5" },
  { key: "date", label: "Date", type: "date" as const },
];
const sumCols = [
  { key: "item_name", label: "Item", type: "text" as const },
  { key: "unit", label: "Unit", type: "text" as const },
  { key: "qty", label: "Qty", type: "number" as const, align: "right" as const, step: "0.01" },
  { key: "unit_cost", label: "Unit Cost", type: "number" as const, align: "right" as const, step: "0.01" },
];

const mat = (r: Record<string, unknown>) => Number(r.qty || 0) * Number(r.unit_cost || 0);
const wf = (r: Record<string, unknown>) => Number(r.qty || 0) * Number(r.hrs_per_person || 0);

export function WorksheetPanels({
  job,
  editable,
  quoteMaterials,
  quoteWorkforce,
  quotationSummary,
  actualMaterials,
  actualWorkforce,
  actualSummary,
}: {
  job: JobView;
  editable: boolean;
  quoteMaterials: QuoteMaterial[];
  quoteWorkforce: QuoteWorkforce[];
  quotationSummary: QuotationSummary[];
  actualMaterials: ActualMaterial[];
  actualWorkforce: ActualWorkforce[];
  actualSummary: ActualSummary[];
}) {
  const jobId = job.id as string;
  const save = (table: Parameters<typeof replaceJobLines>[1]) => (rows: Row[]) =>
    replaceJobLines(jobId, table, rows);

  return (
    <div className="grid gap-4 p-6 lg:grid-cols-3">
      {/* LEFT — Quote */}
      <section className="space-y-4">
        <PanelHeading label="Quote" tone="steel" />
        <EditableTable
          title="Material MTO"
          columns={matCols}
          initialRows={quoteMaterials as unknown as Row[]}
          editable={editable}
          onSave={save("job_quote_materials")}
          computeTotal={mat}
        />
        <EditableTable
          title="Workforce"
          columns={wfCols}
          initialRows={quoteWorkforce as unknown as Row[]}
          editable={editable}
          onSave={save("job_quote_workforce")}
          computeTotal={wf}
          totalKind="number"
        />
      </section>

      {/* CENTRE — Quotation Summary + financials */}
      <section className="space-y-4">
        <PanelHeading label="Quotation Summary" tone="amber" />
        <EditableTable
          title="Summary Line Items"
          columns={sumCols}
          initialRows={quotationSummary as unknown as Row[]}
          editable={editable}
          onSave={save("job_quotation_summary")}
          computeTotal={mat}
        />
        <QuoteFinancials job={job} editable={editable} />
      </section>

      {/* RIGHT — Actual */}
      <section className="space-y-4">
        <PanelHeading label="Actual" tone="steel" />
        <EditableTable
          title="Actual Material MTO"
          columns={matCols}
          initialRows={actualMaterials as unknown as Row[]}
          editable={editable}
          onSave={save("job_actual_materials")}
          computeTotal={mat}
        />
        <EditableTable
          title="Actual Workforce Log"
          columns={wfCols}
          initialRows={actualWorkforce as unknown as Row[]}
          editable={editable}
          onSave={save("job_actual_workforce")}
          computeTotal={wf}
          totalKind="number"
        />
        <EditableTable
          title="Actual Cost Summary"
          columns={sumCols}
          initialRows={actualSummary as unknown as Row[]}
          editable={editable}
          onSave={save("job_actual_summary")}
          computeTotal={mat}
        />
        <ActualFinancials job={job} editable={editable} />
      </section>
    </div>
  );
}

function PanelHeading({ label, tone }: { label: string; tone: "steel" | "amber" }) {
  return (
    <div
      className={`border-l-2 pl-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] ${
        tone === "steel" ? "border-steel text-steel" : "border-amber text-amber"
      }`}
    >
      {label}
    </div>
  );
}

function QuoteFinancials({ job, editable }: { job: JobView; editable: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [qbm, setQbm] = useState(String(job.quote_before_margin ?? 0));
  const [marginPct, setMarginPct] = useState(String(((job.margin ?? 0) * 100).toFixed(2)));

  const finalQuote = Number(qbm || 0) * (1 + Number(marginPct || 0) / 100);

  const save = () =>
    start(async () => {
      const res = await updateJobDetails(job.id as string, {
        quote_before_margin: Number(qbm || 0),
        margin: Number(marginPct || 0) / 100,
      });
      if (res?.error) toast({ variant: "destructive", title: "Save failed", description: res.error });
      else {
        toast({ title: "Quote updated" });
        router.refresh();
      }
    });

  return (
    <div className="panel-surface p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide">Quote Financials</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-panel-foreground/60">Quote (before margin)</Label>
          <Input
            type="number"
            step="0.01"
            value={qbm}
            disabled={!editable}
            onChange={(e) => setQbm(e.target.value)}
            className="h-7 bg-background text-xs text-panel-foreground"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-panel-foreground/60">Margin %</Label>
          <Input
            type="number"
            step="0.1"
            value={marginPct}
            disabled={!editable}
            onChange={(e) => setMarginPct(e.target.value)}
            className="h-7 bg-background text-xs text-panel-foreground"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-panel-border pt-2">
        <span className="text-xs font-semibold uppercase">Final Quote</span>
        <span className="font-mono text-base font-bold">{formatAED(finalQuote)}</span>
      </div>
      {editable && (
        <Button size="sm" className="mt-2 h-7 w-full" onClick={save} disabled={pending} type="button">
          <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save Quote"}
        </Button>
      )}
    </div>
  );
}

function ActualFinancials({ job, editable }: { job: JobView; editable: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [actual, setActual] = useState(
    job.actual_cost == null ? "" : String(job.actual_cost),
  );
  const [charge, setCharge] = useState(
    job.charge_to_site == null ? "" : String(job.charge_to_site),
  );

  const save = () =>
    start(async () => {
      const res = await updateJobDetails(job.id as string, {
        actual_cost: actual === "" ? null : Number(actual),
        charge_to_site: charge === "" ? null : Number(charge),
      });
      if (res?.error) toast({ variant: "destructive", title: "Save failed", description: res.error });
      else {
        toast({ title: "Actuals updated" });
        router.refresh();
      }
    });

  return (
    <div className="panel-surface p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide">Actual Cost &amp; P/L</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-panel-foreground/60">Actual Cost</Label>
          <Input
            type="number"
            step="0.01"
            value={actual}
            disabled={!editable}
            onChange={(e) => setActual(e.target.value)}
            className="h-7 bg-background text-xs text-panel-foreground"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-panel-foreground/60">Charge to Site</Label>
          <Input
            type="number"
            step="0.01"
            value={charge}
            disabled={!editable}
            onChange={(e) => setCharge(e.target.value)}
            className="h-7 bg-background text-xs text-panel-foreground"
          />
        </div>
      </div>
      <div className="mt-3 space-y-1 border-t border-panel-border pt-2 text-xs">
        <Stat label="Profit / Loss" value={formatAED(job.profit_loss)} />
        <Stat label="P/L %" value={formatPercent(job.pl_percentage)} />
      </div>
      {editable && (
        <Button size="sm" className="mt-2 h-7 w-full" onClick={save} disabled={pending} type="button">
          <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save Actuals"}
        </Button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="uppercase text-panel-foreground/60">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

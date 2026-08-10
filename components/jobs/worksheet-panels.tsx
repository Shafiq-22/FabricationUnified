"use client";

import { EditableTable } from "@/components/jobs/editable-table";
import { WorkforceEditor } from "@/components/jobs/workforce-editor";
import { AnalyticsPanel } from "@/components/jobs/analytics-panel";
import { TentativePanel, type HistoricLookup } from "@/components/jobs/tentative-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportDialog } from "@/components/jobs/import-dialog";
import { replaceJobLines, type Row } from "@/app/(app)/jobs/[id]/worksheet/actions";
import { formatAED } from "@/lib/utils";
import type { JobView } from "@/lib/types";

const matCols = [
  { key: "material_name", label: "Material", type: "text" as const },
  { key: "dimension", label: "Dimension", type: "text" as const, placeholder: "e.g. 200x100x8" },
  { key: "unit", label: "Unit", type: "text" as const },
  { key: "qty", label: "Qty", type: "number" as const, align: "right" as const, step: "0.01" },
  { key: "unit_cost", label: "Unit Cost", type: "number" as const, align: "right" as const, step: "0.01" },
];
const consCols = [
  { key: "item_name", label: "Item", type: "text" as const },
  { key: "unit", label: "Unit", type: "text" as const },
  { key: "qty", label: "Qty", type: "number" as const, align: "right" as const, step: "0.01" },
  { key: "unit_cost", label: "Unit Cost", type: "number" as const, align: "right" as const, step: "0.01" },
];

const sumCost = (rows: Row[]) =>
  rows.reduce((s, r) => s + Number(r.qty || 0) * Number(r.unit_cost || 0), 0);
const sumWf = (rows: Row[]) =>
  rows.reduce(
    (s, r) => s + Number(r.qty || 0) * Number(r.hrs_per_person || 0) * Number(r.rate_aed_per_hr || 0),
    0,
  );

export function WorksheetPanels({
  job,
  editable,
  margins,
  rates,
  historic,
  quoteMaterials,
  quoteWorkforce,
  quoteConsumables,
  actualMaterials,
  actualWorkforce,
  actualConsumables,
}: {
  job: JobView;
  editable: boolean;
  margins: { material: number; workforce: number; consumables: number };
  rates: { designation: string; rate: number }[];
  historic: HistoricLookup;
  quoteMaterials: Row[];
  quoteWorkforce: Row[];
  quoteConsumables: Row[];
  actualMaterials: Row[];
  actualWorkforce: Row[];
  actualConsumables: Row[];
}) {
  const jobId = job.id as string;
  const save = (table: Parameters<typeof replaceJobLines>[1]) => (rows: Row[]) =>
    replaceJobLines(jobId, table, rows);

  // Saved-state subtotals (refresh after each save keeps these current).
  const mSub = sumCost(quoteMaterials);
  const wSub = sumWf(quoteWorkforce);
  const cSub = sumCost(quoteConsumables);
  const mTot = mSub * (1 + margins.material / 100);
  const wTot = wSub * (1 + margins.workforce / 100);
  const cTot = cSub * (1 + margins.consumables / 100);
  const qbm = mSub + wSub + cSub;
  const finalQuote = mTot + wTot + cTot;
  const unitCost = job.qty && job.qty !== 0 ? finalQuote / job.qty : null;

  const amSub = sumCost(actualMaterials);
  const awSub = sumWf(actualWorkforce);
  const acSub = sumCost(actualConsumables);
  const hasActual =
    actualMaterials.length + actualWorkforce.length + actualConsumables.length > 0;
  const actualCost = hasActual ? amSub + awSub + acSub : null;
  const marginPct = qbm === 0 ? 0 : (finalQuote / qbm - 1) * 100;

  const tentativeItems = [
    ...quoteMaterials.map((r) => ({
      name: String(r.material_name ?? ""),
      unit: (r.unit as string) ?? null,
      qty: r.qty == null ? null : Number(r.qty),
      kind: "Material" as const,
    })),
    ...quoteConsumables.map((r) => ({
      name: String(r.item_name ?? ""),
      unit: (r.unit as string) ?? null,
      qty: r.qty == null ? null : Number(r.qty),
      kind: "Consumable" as const,
    })),
  ].filter((i) => i.name);

  return (
    <div className="p-6">
      <Tabs defaultValue="quotation">
        <TabsList>
          <TabsTrigger value="quotation">Quotation</TabsTrigger>
          <TabsTrigger value="actual">Actual</TabsTrigger>
          <TabsTrigger value="tentative">Tentative</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* QUOTATION */}
        <TabsContent value="quotation" className="space-y-4">
          {editable && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Import from a spreadsheet:</span>
              <ImportDialog jobId={jobId} target="job_quote_materials" label="Import Materials" />
              <ImportDialog
                jobId={jobId}
                target="job_quote_consumables"
                label="Import Consumables"
              />
            </div>
          )}
          <EditableTable
            title="Material MTO"
            columns={matCols}
            initialRows={quoteMaterials}
            editable={editable}
            onSave={save("job_quote_materials")}
            computeTotal={(r) => Number(r.qty || 0) * Number(r.unit_cost || 0)}
            marginPct={margins.material}
          />
          <WorkforceEditor
            title="Workforce"
            jobId={jobId}
            table="job_quote_workforce"
            rows={quoteWorkforce}
            editable={editable}
            rates={rates}
            marginPct={margins.workforce}
          />
          <EditableTable
            title="Consumables"
            columns={consCols}
            initialRows={quoteConsumables}
            editable={editable}
            onSave={save("job_quote_consumables")}
            computeTotal={(r) => Number(r.qty || 0) * Number(r.unit_cost || 0)}
            marginPct={margins.consumables}
          />
          <SummaryCard
            description={job.description}
            unit={job.unit}
            qty={job.qty}
            unitCost={unitCost}
            total={finalQuote}
          />
        </TabsContent>

        {/* ACTUAL (cost only, no margin) */}
        <TabsContent value="actual" className="space-y-4">
          <EditableTable
            title="Actual Material MTO"
            columns={matCols}
            initialRows={actualMaterials}
            editable={editable}
            onSave={save("job_actual_materials")}
            computeTotal={(r) => Number(r.qty || 0) * Number(r.unit_cost || 0)}
          />
          <WorkforceEditor
            title="Actual Workforce Log"
            jobId={jobId}
            table="job_actual_workforce"
            rows={actualWorkforce}
            editable={editable}
            rates={rates}
            marginPct={null}
          />
          <EditableTable
            title="Actual Consumables"
            columns={consCols}
            initialRows={actualConsumables}
            editable={editable}
            onSave={save("job_actual_consumables")}
            computeTotal={(r) => Number(r.qty || 0) * Number(r.unit_cost || 0)}
          />
          <div className="panel-surface flex items-center justify-between p-3">
            <span className="text-xs font-semibold uppercase">Total Actual Cost</span>
            <span className="font-mono text-base font-bold">{formatAED(actualCost ?? 0)}</span>
          </div>
        </TabsContent>

        {/* TENTATIVE */}
        <TabsContent value="tentative">
          <TentativePanel items={tentativeItems} historic={historic} />
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics">
          <AnalyticsPanel
            quoteBeforeMargin={qbm}
            finalQuote={finalQuote}
            marginPct={marginPct}
            actualCost={actualCost}
            categories={[
              { name: "Material", quote: mSub, actual: amSub },
              { name: "Workforce", quote: wSub, actual: awSub },
              { name: "Consumables", quote: cSub, actual: acSub },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  description,
  unit,
  qty,
  unitCost,
  total,
}: {
  description: string | null;
  unit: string | null;
  qty: number | null;
  unitCost: number | null;
  total: number;
}) {
  return (
    <div className="panel-surface">
      <div className="border-b border-panel-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">Quotation Summary</h3>
      </div>
      <table className="w-full text-xs tabular">
        <thead>
          <tr className="header-band border-b border-panel-border">
            <th className="px-2 py-1.5 text-left font-semibold uppercase">Description</th>
            <th className="px-2 py-1.5 text-left font-semibold uppercase">Unit</th>
            <th className="px-2 py-1.5 text-right font-semibold uppercase">Qty</th>
            <th className="px-2 py-1.5 text-right font-semibold uppercase">Unit Cost</th>
            <th className="px-2 py-1.5 text-right font-semibold uppercase">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-panel-border/60">
            <td className="px-2 py-1.5">{description ?? "—"}</td>
            <td className="px-2 py-1.5">{unit ?? "—"}</td>
            <td className="px-2 py-1.5 text-right">{qty ?? "—"}</td>
            <td className="px-2 py-1.5 text-right">{unitCost == null ? "—" : formatAED(unitCost)}</td>
            <td className="px-2 py-1.5 text-right font-medium">{formatAED(total)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="border-t border-panel-border font-semibold">
            <td colSpan={4} className="px-2 py-1.5 text-right uppercase">
              Final Quote
            </td>
            <td className="px-2 py-1.5 text-right text-sm">{formatAED(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

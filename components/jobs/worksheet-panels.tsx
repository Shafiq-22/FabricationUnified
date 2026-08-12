"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Percent, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { EditableTable } from "@/components/jobs/editable-table";
import { WorkforceEditor } from "@/components/jobs/workforce-editor";
import { EquipmentTable } from "@/components/jobs/equipment-charges-table";
import { AnalyticsPanel } from "@/components/jobs/analytics-panel";
import { TentativePanel, type HistoricLookup } from "@/components/jobs/tentative-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportDialog } from "@/components/jobs/import-dialog";
import {
  replaceJobLines,
  copyQuoteToActual,
  type Row,
} from "@/app/(app)/jobs/[id]/worksheet/actions";
import { formatAED } from "@/lib/utils";
import type { JobView } from "@/lib/types";

const PART = { key: "part_ref", label: "Part No. / Name", type: "text" as const, placeholder: "e.g. P-01 Base plate" };

const matCols = [
  PART,
  { key: "material_name", label: "Material", type: "text" as const },
  { key: "dimension", label: "Dimension", type: "text" as const, placeholder: "e.g. 200x100x8" },
  { key: "unit", label: "Unit", type: "text" as const },
  { key: "qty", label: "Qty", type: "number" as const, align: "right" as const, step: "0.01" },
  { key: "unit_cost", label: "Unit Cost", type: "number" as const, align: "right" as const, step: "0.01" },
];
const consCols = [
  PART,
  { key: "item_name", label: "Item", type: "text" as const },
  { key: "unit", label: "Unit", type: "text" as const },
  { key: "qty", label: "Qty", type: "number" as const, align: "right" as const, step: "0.01" },
  { key: "unit_cost", label: "Unit Cost", type: "number" as const, align: "right" as const, step: "0.01" },
];

const svcCols = [
  PART,
  { key: "service_name", label: "Service", type: "text" as const, placeholder: "Galvanising / NDT / Blasting…" },
  { key: "provider", label: "Provider", type: "text" as const },
  { key: "unit", label: "Unit", type: "text" as const },
  { key: "qty", label: "Qty", type: "number" as const, align: "right" as const, step: "0.01" },
  { key: "unit_cost", label: "Unit Cost", type: "number" as const, align: "right" as const, step: "0.01" },
];

const eqpCols = [
  PART,
  { key: "description", label: "Machine / Plant", type: "text" as const, placeholder: "Sixco no. or hired-in plant" },
  { key: "hours", label: "Hours", type: "number" as const, align: "right" as const, step: "0.01" },
  { key: "rate_aed_per_hr", label: "Rate/hr", type: "number" as const, align: "right" as const, step: "0.01" },
];

/**
 * Actual material columns: the quoted set plus where the material came from.
 * Ticking "In Stock" marks the line as drawn from the yard; naming the stock
 * item then prices it at what that item is carried at.
 */
const actualMatCols = (
  stockOptions: { id: string; label: string; unitCost: number | null }[],
) => [
  ...matCols,
  { key: "from_stock", label: "In Stock", type: "checkbox" as const },
  {
    key: "inventory_item_id",
    label: "Stock Item",
    type: "select" as const,
    options: stockOptions.map((s) => ({ value: s.id, label: s.label })),
    emptyOption: "— bought in —",
  },
];

const sumCost = (rows: Row[]) =>
  rows.reduce((s, r) => s + Number(r.qty || 0) * Number(r.unit_cost || 0), 0);
const sumHours = (rows: Row[]) =>
  rows.reduce((s, r) => s + Number(r.hours || 0) * Number(r.rate_aed_per_hr || 0), 0);
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
  quoteEquipment,
  actualEquipment,
  quoteServices,
  actualServices,
  equipmentOptions,
  stockOptions,
  inflationPct,
}: {
  job: JobView;
  editable: boolean;
  margins: {
    material: number;
    workforce: number;
    consumables: number;
    equipment: number;
    services: number;
  };
  rates: { designation: string; rate: number }[];
  historic: HistoricLookup;
  quoteMaterials: Row[];
  quoteWorkforce: Row[];
  quoteConsumables: Row[];
  actualMaterials: Row[];
  actualWorkforce: Row[];
  actualConsumables: Row[];
  quoteEquipment: Row[];
  actualEquipment: Row[];
  quoteServices: Row[];
  actualServices: Row[];
  /** Machines from the Personnel & Equipment register, with their rates. */
  equipmentOptions: { id: string; label: string; bare: number; driver: number }[];
  /** Stock an Actual material line can be drawn from, with its carried cost. */
  stockOptions: { id: string; label: string; unitCost: number | null }[];
  inflationPct: number;
}) {
  const jobId = job.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const [transferring, startTransfer] = useTransition();
  const save = (table: Parameters<typeof replaceJobLines>[1]) => (rows: Row[]) =>
    replaceJobLines(jobId, table, rows);

  // Picking a stock item prices the line at what that item is carried at, and
  // implies the line came from stock. Clearing the tick clears the item too,
  // so a bought-in line never keeps a stale stock reference.
  const deriveStock = (col: string, value: unknown, row: Record<string, unknown>) => {
    if (col === "inventory_item_id") {
      if (!value) return { from_stock: false };
      const picked = stockOptions.find((s) => s.id === value);
      return {
        from_stock: true,
        ...(picked?.unitCost != null && !row.unit_cost ? { unit_cost: picked.unitCost } : {}),
      };
    }
    if (col === "from_stock" && value !== true) return { inventory_item_id: "" };
    return null;
  };

  // Cost-control view: with margins off the Quotation tab shows the bare cost
  // base instead of the marked-up figures. Display only — nothing is written,
  // so the stored quote and the margins in Settings are untouched.
  const [showMargins, setShowMargins] = useState(true);
  const withMargin = (pct: number) => (showMargins ? pct : null);

  const transferToActual = () => {
    if (
      !confirm(
        "Copy every Quotation line into Actual?\n\nThis replaces whatever the Actual tab currently holds.",
      )
    )
      return;
    startTransfer(async () => {
      const res = await copyQuoteToActual(jobId);
      if (res.error) {
        toast({ variant: "destructive", title: "Transfer failed", description: res.error });
      } else {
        toast({
          title: "Copied to Actual",
          description: `${res.copied ?? 0} line(s) transferred. Adjust them against what was really used.`,
        });
        router.refresh();
      }
    });
  };

  // Saved-state subtotals (refresh after each save keeps these current).
  const mSub = sumCost(quoteMaterials);
  const wSub = sumWf(quoteWorkforce);
  const cSub = sumCost(quoteConsumables);
  const eSub = sumHours(quoteEquipment);
  const sSub = sumCost(quoteServices);
  const mTot = mSub * (1 + margins.material / 100);
  const wTot = wSub * (1 + margins.workforce / 100);
  const cTot = cSub * (1 + margins.consumables / 100);
  const eTot = eSub * (1 + margins.equipment / 100);
  const sTot = sSub * (1 + margins.services / 100);
  const qbm = mSub + wSub + cSub + eSub + sSub;
  const finalQuote = mTot + wTot + cTot + eTot + sTot;
  const unitCost = job.qty && job.qty !== 0 ? finalQuote / job.qty : null;
  const costUnitCost = job.qty && job.qty !== 0 ? qbm / job.qty : null;

  const amSub = sumCost(actualMaterials);
  const awSub = sumWf(actualWorkforce);
  const acSub = sumCost(actualConsumables);
  const aeSub = sumHours(actualEquipment);
  const asSub = sumCost(actualServices);
  const hasActual =
    actualMaterials.length + actualWorkforce.length + actualConsumables.length +
    actualEquipment.length + actualServices.length > 0;
  const actualCost = hasActual ? amSub + awSub + acSub + aeSub + asSub : null;
  // How much of the actual material spend was drawn from stock rather than
  // bought for this job.
  const fromStockValue = actualMaterials
    .filter((r) => r.from_stock === true)
    .reduce((s, r) => s + Number(r.qty || 0) * Number(r.unit_cost || 0), 0);
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={showMargins ? "outline" : "default"}
              size="sm"
              className="h-7"
              onClick={() => setShowMargins((v) => !v)}
              title="Show the cost base without margins, for cost control"
            >
              <Percent className="h-3.5 w-3.5" />
              Margins: {showMargins ? "On" : "Off"}
            </Button>
            {!showMargins && (
              <span className="text-xs text-amber">
                Showing cost before margin — display only, nothing is saved.
              </span>
            )}
            {editable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                disabled={transferring}
                onClick={transferToActual}
                title="Copy every quoted line into the Actual tab"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                {transferring ? "Copying…" : "Copy to Actual"}
              </Button>
            )}
          </div>
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
            marginPct={withMargin(margins.material)}
            groupBy="part_ref"
          />
          <WorkforceEditor
            title="Workforce"
            jobId={jobId}
            table="job_quote_workforce"
            rows={quoteWorkforce}
            editable={editable}
            rates={rates}
            marginPct={withMargin(margins.workforce)}
          />
          <EditableTable
            title="Consumables"
            columns={consCols}
            initialRows={quoteConsumables}
            editable={editable}
            onSave={save("job_quote_consumables")}
            computeTotal={(r) => Number(r.qty || 0) * Number(r.unit_cost || 0)}
            marginPct={withMargin(margins.consumables)}
            groupBy="part_ref"
          />
          <EquipmentTable
            title="Equipment Charges"
            rows={quoteEquipment}
            options={equipmentOptions}
            editable={editable}
            onSave={save("job_quote_equipment")}
            marginPct={withMargin(margins.equipment)}
          />
          <EditableTable
            title="Service Charges"
            columns={svcCols}
            initialRows={quoteServices}
            editable={editable}
            onSave={save("job_quote_services")}
            computeTotal={(r) => Number(r.qty || 0) * Number(r.unit_cost || 0)}
            marginPct={withMargin(margins.services)}
            groupBy="part_ref"
            emptyHint="Bought-in work: galvanising, NDT, blasting, transport…"
          />
          <SummaryCard
            description={job.description}
            unit={job.unit}
            qty={job.qty}
            unitCost={showMargins ? unitCost : costUnitCost}
            total={showMargins ? finalQuote : qbm}
            label={showMargins ? "Final Quote" : "Cost before margin"}
          />
        </TabsContent>

        {/* ACTUAL (cost only, no margin) */}
        <TabsContent value="actual" className="space-y-4">
          <EditableTable
            title="Actual Material MTO"
            columns={actualMatCols(stockOptions)}
            initialRows={actualMaterials}
            editable={editable}
            onSave={save("job_actual_materials")}
            computeTotal={(r) => Number(r.qty || 0) * Number(r.unit_cost || 0)}
            groupBy="part_ref"
            derive={deriveStock}
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
            groupBy="part_ref"
          />
          <EquipmentTable
            title="Actual Equipment Charges"
            rows={actualEquipment}
            options={equipmentOptions}
            editable={editable}
            onSave={save("job_actual_equipment")}
            marginPct={null}
          />
          <EditableTable
            title="Actual Service Charges"
            columns={svcCols}
            initialRows={actualServices}
            editable={editable}
            onSave={save("job_actual_services")}
            computeTotal={(r) => Number(r.qty || 0) * Number(r.unit_cost || 0)}
            groupBy="part_ref"
          />
          <QuotedVsActual
            rows={[
              { name: "Material", quoted: mSub, actual: amSub },
              { name: "Workforce", quoted: wSub, actual: awSub },
              { name: "Consumables", quoted: cSub, actual: acSub },
              { name: "Equipment", quoted: eSub, actual: aeSub },
              { name: "Services", quoted: sSub, actual: asSub },
            ]}
            fromStockValue={fromStockValue}
            totalQuoted={qbm}
            totalActual={actualCost ?? 0}
          />
        </TabsContent>

        {/* TENTATIVE */}
        <TabsContent value="tentative">
          <TentativePanel
            items={tentativeItems}
            historic={historic}
            inflationPct={inflationPct}
            jobId={jobId}
            editable={editable}
          />
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

/**
 * Section-by-section comparison of what was quoted against what the job
 * actually cost, with the stock-drawn share called out — material taken from
 * the yard still costs the business, it just was not bought for this job.
 */
function QuotedVsActual({
  rows,
  fromStockValue,
  totalQuoted,
  totalActual,
}: {
  rows: { name: string; quoted: number; actual: number }[];
  fromStockValue: number;
  totalQuoted: number;
  totalActual: number;
}) {
  const variance = totalActual - totalQuoted;
  return (
    <div className="panel-surface">
      <div className="border-b border-panel-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">
          Actual vs Quoted (cost before margin)
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular">
          <thead>
            <tr className="header-band border-b border-panel-border">
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide">Section</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Quoted</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Actual</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = r.actual - r.quoted;
              return (
                <tr key={r.name} className="border-b border-panel-border/60">
                  <td className="px-2 py-1">{r.name}</td>
                  <td className="px-2 py-1 text-right">{formatAED(r.quoted)}</td>
                  <td className="px-2 py-1 text-right">{formatAED(r.actual)}</td>
                  <td
                    className={`px-2 py-1 text-right font-medium ${
                      v > 0 ? "text-destructive" : v < 0 ? "text-status-com" : ""
                    }`}
                  >
                    {v > 0 ? "+" : ""}
                    {formatAED(v)}
                  </td>
                </tr>
              );
            })}
            {fromStockValue > 0 && (
              <tr className="border-b border-panel-border/60 bg-secondary/40">
                <td colSpan={3} className="px-2 py-1 text-panel-foreground/70">
                  of which drawn from stock (not bought for this job)
                </td>
                <td className="px-2 py-1 text-right font-medium">{formatAED(fromStockValue)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-panel-border font-semibold">
              <td className="px-2 py-1.5 uppercase">Total</td>
              <td className="px-2 py-1.5 text-right">{formatAED(totalQuoted)}</td>
              <td className="px-2 py-1.5 text-right">{formatAED(totalActual)}</td>
              <td
                className={`px-2 py-1.5 text-right ${
                  variance > 0 ? "text-destructive" : variance < 0 ? "text-status-com" : ""
                }`}
              >
                {variance > 0 ? "+" : ""}
                {formatAED(variance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  description,
  unit,
  qty,
  unitCost,
  total,
  label = "Final Quote",
}: {
  description: string | null;
  unit: string | null;
  qty: number | null;
  unitCost: number | null;
  total: number;
  /** Footer caption — flips when the margin toggle is off. */
  label?: string;
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
              {label}
            </td>
            <td className="px-2 py-1.5 text-right text-sm">{formatAED(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

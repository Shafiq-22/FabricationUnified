"use client";

import { EditableTable } from "@/components/jobs/editable-table";
import { replaceJobLines, type Row } from "@/app/(app)/jobs/[id]/worksheet/actions";

const itemCols = [
  { key: "profile_type", label: "Profile", type: "text" as const, placeholder: "SHS / CHS / UPN…" },
  { key: "dimension", label: "Dimension", type: "text" as const, placeholder: "e.g. 100x100x5" },
  { key: "length_m", label: "Length (m)", type: "number" as const, align: "right" as const, step: "0.001" },
  { key: "qty", label: "Qty", type: "number" as const, align: "right" as const, step: "1" },
];

const plateCols = [
  { key: "thickness_mm", label: "Thk (mm)", type: "number" as const, align: "right" as const, step: "0.1" },
  { key: "plate_size", label: "Sheet", type: "text" as const, placeholder: "2x6 / 1.5x6 / custom" },
  { key: "length_mm", label: "L (mm)", type: "number" as const, align: "right" as const, step: "1" },
  { key: "width_mm", label: "W (mm)", type: "number" as const, align: "right" as const, step: "1" },
  { key: "qty", label: "Qty", type: "number" as const, align: "right" as const, step: "1" },
];

const lenTotal = (r: Record<string, unknown>) =>
  Number(r.length_m || 0) * Number(r.qty || 0);
const areaTotal = (r: Record<string, unknown>) =>
  (Number(r.length_mm || 0) / 1000) * (Number(r.width_mm || 0) / 1000) * Number(r.qty || 0);

export function RoughItemsEditor({
  jobId,
  editable,
  rows,
}: {
  jobId: string;
  editable: boolean;
  rows: Row[];
}) {
  return (
    <EditableTable
      title="Cut List"
      columns={itemCols}
      initialRows={rows}
      editable={editable}
      onSave={(r) => replaceJobLines(jobId, "rough_sheet_items", r)}
      computeTotal={lenTotal}
      totalKind="number"
      emptyHint="Add profile cuts (length × qty per row)."
    />
  );
}

export function RoughPlatesEditor({
  jobId,
  editable,
  rows,
}: {
  jobId: string;
  editable: boolean;
  rows: Row[];
}) {
  return (
    <EditableTable
      title="Plate Cut List"
      columns={plateCols}
      initialRows={rows}
      editable={editable}
      onSave={(r) => replaceJobLines(jobId, "cut_list_plates", r)}
      computeTotal={areaTotal}
      totalKind="number"
      emptyHint="Add plate cuts by thickness and sheet size."
    />
  );
}

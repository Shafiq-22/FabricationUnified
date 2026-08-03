"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";
import {
  COLUMN_HINTS,
  guessColumn,
  parseCsv,
  toNumber,
  toText,
  type SheetData,
} from "@/lib/parsers/excel";
import { parseDstvFiles } from "@/lib/parsers/dstv";
import { appendJobLines, type ImportTarget } from "@/app/(app)/jobs/[id]/import-actions";

/** Fields each import target expects, in display order. */
const TARGET_FIELDS: Record<ImportTarget, { key: string; label: string; numeric?: boolean }[]> = {
  rough_sheet_items: [
    { key: "profile_type", label: "Profile" },
    { key: "dimension", label: "Dimension" },
    { key: "length_m", label: "Length (m)", numeric: true },
    { key: "qty", label: "Qty", numeric: true },
  ],
  job_quote_materials: [
    { key: "material_name", label: "Material" },
    { key: "unit", label: "Unit" },
    { key: "qty", label: "Qty", numeric: true },
    { key: "unit_cost", label: "Unit Cost", numeric: true },
  ],
  job_quote_consumables: [
    { key: "item_name", label: "Item" },
    { key: "unit", label: "Unit" },
    { key: "qty", label: "Qty", numeric: true },
    { key: "unit_cost", label: "Unit Cost", numeric: true },
  ],
};

const NONE = "__none__";

export function ImportDialog({
  jobId,
  target,
  label,
  allowDstv = false,
}: {
  jobId: string;
  target: ImportTarget;
  label: string;
  allowDstv?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  const fields = TARGET_FIELDS[target];
  const sheet = sheets[sheetIdx];

  const reset = () => {
    setSheets([]);
    setSheetIdx(0);
    setMapping({});
    setError(null);
  };

  const autoMap = (s: SheetData) => {
    const m: Record<string, number> = {};
    fields.forEach((f) => {
      m[f.key] = guessColumn(s.headers, COLUMN_HINTS[f.key] ?? [f.label]);
    });
    setMapping(m);
  };

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const first = files[0];
      const name = first.name.toLowerCase();

      // --- DSTV: many .nc1 files at once, no column mapping needed ---
      if (allowDstv && (name.endsWith(".nc") || name.endsWith(".nc1"))) {
        const texts = await Promise.all(
          Array.from(files).map(async (f) => ({ name: f.name, text: await f.text() })),
        );
        const parts = parseDstvFiles(texts);
        if (parts.length === 0) {
          setError("No valid DSTV headers found in those files.");
          return;
        }
        const s: SheetData = {
          name: `${parts.length} DSTV part(s)`,
          headers: ["profile_type", "dimension", "length_m", "qty"],
          rows: parts.map((p) => [p.profile_type, p.piece_mark, p.length_m, p.qty]),
        };
        setSheets([s]);
        setSheetIdx(0);
        setMapping({ profile_type: 0, dimension: 1, length_m: 2, qty: 3 });
        return;
      }

      // --- CSV ---
      if (name.endsWith(".csv")) {
        const s = parseCsv(await first.text());
        setSheets([s]);
        setSheetIdx(0);
        autoMap(s);
        return;
      }

      // --- Excel (dynamically imported to keep it out of the main bundle) ---
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await first.arrayBuffer());
      const parsed: SheetData[] = [];
      wb.eachSheet((ws) => {
        const rows: (string | number | null)[][] = [];
        let headers: string[] = [];
        ws.eachRow((row, rowNumber) => {
          const values = (row.values as unknown[]).slice(1).map((v) => toText(v));
          if (rowNumber === 1) headers = values;
          else rows.push(values);
        });
        if (headers.length) parsed.push({ name: ws.name, headers, rows });
      });
      if (parsed.length === 0) {
        setError("No readable sheets in that workbook.");
        return;
      }
      setSheets(parsed);
      setSheetIdx(0);
      autoMap(parsed[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  /** Build the rows to insert from the current mapping. */
  const buildRows = () => {
    if (!sheet) return [];
    return sheet.rows
      .map((r) => {
        const obj: Record<string, unknown> = {};
        fields.forEach((f) => {
          const idx = mapping[f.key];
          const raw = idx != null && idx >= 0 ? r[idx] : null;
          obj[f.key] = f.numeric ? toNumber(raw) : toText(raw);
        });
        return obj;
      })
      // Skip rows where every mapped field is empty.
      .filter((o) => fields.some((f) => o[f.key] !== "" && o[f.key] !== null));
  };

  const preview = buildRows();

  const submit = () => {
    if (preview.length === 0) {
      setError("Nothing to import — check the column mapping.");
      return;
    }
    setBusy(true);
    start(async () => {
      const res = await appendJobLines(jobId, target, preview);
      setBusy(false);
      if (res.error) {
        setError(res.error);
      } else {
        toast({ title: "Imported", description: `${preview.length} row(s) added.` });
        setOpen(false);
        reset();
        router.refresh();
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">
              File{" "}
              <span className="text-muted-foreground">
                (.xlsx / .csv{allowDstv ? " / .nc, .nc1 — select many" : ""})
              </span>
            </Label>
            <Input
              type="file"
              multiple={allowDstv}
              accept={allowDstv ? ".xlsx,.xls,.csv,.nc,.nc1" : ".xlsx,.xls,.csv"}
              onChange={(e) => onFiles(e.target.files)}
              className="text-xs file:mr-2 file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
            />
          </div>

          {sheets.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Sheet</Label>
              <Select
                value={String(sheetIdx)}
                onValueChange={(v) => {
                  const i = Number(v);
                  setSheetIdx(i);
                  autoMap(sheets[i]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((s, i) => (
                    <SelectItem key={s.name + i} value={String(i)}>
                      {s.name} ({s.rows.length} rows)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {sheet && (
            <>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Column mapping
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {fields.map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-xs">{f.label}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <Select
                        value={String(mapping[f.key] ?? -1)}
                        onValueChange={(v) =>
                          setMapping((m) => ({ ...m, [f.key]: Number(v) }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-1">— Not mapped —</SelectItem>
                          {sheet.headers.map((h, i) => (
                            <SelectItem key={`${h}-${i}`} value={String(i)}>
                              {h || `Column ${i + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Preview — {preview.length} row(s) will be added
                </h4>
                <div className="max-h-52 overflow-auto border border-border">
                  <table className="w-full text-xs tabular">
                    <thead>
                      <tr className="header-band border-b border-border">
                        {fields.map((f) => (
                          <th key={f.key} className="px-2 py-1.5 text-left font-semibold">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 25).map((r, i) => (
                        <tr key={i} className="border-b border-border/60">
                          {fields.map((f) => (
                            <td key={f.key} className="px-2 py-1">
                              {String(r[f.key] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 25 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Showing the first 25 of {preview.length}.
                  </p>
                )}
              </div>
            </>
          )}

          {error && (
            <p className="flex items-center gap-2 border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={busy || preview.length === 0}>
            {busy ? "Importing…" : `Import ${preview.length || ""} row(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

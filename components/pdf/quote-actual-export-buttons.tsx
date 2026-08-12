"use client";

import { useState } from "react";
import { FileText, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import type { QuoteActualData } from "./quote-actual-document";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * PDF and Excel of the quoted-vs-actual comparison. Both are produced entirely
 * in the browser and both libraries are dynamically imported, so neither
 * @react-pdf/renderer nor exceljs is loaded on the server or before the user
 * asks for a file — the same arrangement the other exports here use.
 */
export function QuoteActualExportButtons({ data }: { data: QuoteActualData }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | "pdf" | "xlsx">(null);

  const base = `${data.job.job_code ?? "job"}-quoted-vs-actual`;

  const fail = (err: unknown, what: string) =>
    toast({
      variant: "destructive",
      title: `${what} failed`,
      description: err instanceof Error ? err.message : "Unknown error",
    });

  async function makePdf() {
    setBusy("pdf");
    try {
      const [{ pdf }, { QuoteActualDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./quote-actual-document"),
      ]);
      download(await pdf(<QuoteActualDocument {...data} />).toBlob(), `${base}.pdf`);
    } catch (err) {
      fail(err, "PDF export");
    } finally {
      setBusy(null);
    }
  }

  async function makeXlsx() {
    setBusy("xlsx");
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = data.companyName;
      wb.created = new Date();
      const ws = wb.addWorksheet("Quoted vs Actual");

      ws.mergeCells("A1:E1");
      ws.getCell("A1").value = `${data.companyName} — ${data.departmentName}`;
      ws.getCell("A1").font = { bold: true, size: 13, color: { argb: "FF156082" } };
      ws.mergeCells("A2:E2");
      ws.getCell("A2").value =
        "INTERNAL — contains cost base and margins. Not for issue to the client.";
      ws.getCell("A2").font = { bold: true, size: 9, color: { argb: "FFB3261E" } };

      ws.addRow([]);
      ws.addRow(["Job", data.job.job_code ?? "—"]);
      ws.addRow(["Site", [data.job.site_code, data.job.site_name].filter(Boolean).join(" · ") || "—"]);
      ws.addRow(["Description", data.job.description ?? "—"]);
      ws.addRow(["Status", data.job.status ?? "—"]);
      ws.addRow(["Generated", data.generatedOn]);
      ws.addRow([]);

      const head = ws.addRow(["Section", "Quoted", "Actual", "Variance", "Margin %"]);
      head.font = { bold: true };
      head.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6DCE4" } };
      });

      for (const sec of data.sections) {
        ws.addRow([
          sec.name,
          sec.quoted,
          sec.actual,
          sec.actual - sec.quoted,
          sec.overridden ? `${sec.marginPct} (job)` : sec.marginPct,
        ]);
      }

      const totals = ws.addRow([
        "Total (cost before margin)",
        data.totalQuoted,
        data.totalActual,
        data.totalActual - data.totalQuoted,
        "",
      ]);
      totals.font = { bold: true };
      ws.addRow(["Final quote (with margin)", data.finalQuote, "", "", ""]).font = { bold: true };

      if (data.fromStockValue > 0) {
        ws.addRow([]);
        ws.addRow(["Of which drawn from stock", data.fromStockValue]);
      }

      ws.getColumn(1).width = 34;
      for (const i of [2, 3, 4, 5]) {
        ws.getColumn(i).width = 16;
        ws.getColumn(i).numFmt = "#,##0.00";
      }
      // Margin column is a percentage figure, and may carry a "(job)" marker.
      ws.getColumn(5).numFmt = "General";

      const buf = await wb.xlsx.writeBuffer();
      download(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${base}.xlsx`,
      );
    } catch (err) {
      fail(err, "Excel export");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7"
        onClick={makePdf}
        disabled={busy !== null}
      >
        <FileText className="h-3.5 w-3.5" />
        {busy === "pdf" ? "Generating…" : "PDF"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7"
        onClick={makeXlsx}
        disabled={busy !== null}
      >
        <Sheet className="h-3.5 w-3.5" />
        {busy === "xlsx" ? "Generating…" : "Excel"}
      </Button>
    </>
  );
}

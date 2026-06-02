"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

function escapeCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function CsvExportButton({
  filename,
  columns,
  rows,
}: {
  filename: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}) {
  function download() {
    const header = columns.map((c) => escapeCell(c.label)).join(",");
    const body = rows
      .map((r) => columns.map((c) => escapeCell(r[c.key])).join(","))
      .join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button size="sm" variant="outline" onClick={download} disabled={rows.length === 0} type="button">
      <Download className="h-4 w-4" /> Export CSV
    </Button>
  );
}

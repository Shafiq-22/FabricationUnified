"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import type { TimesheetPdfData } from "./timesheet-document";

export function TimesheetPdfButton({
  data,
  filename,
}: {
  data: TimesheetPdfData;
  filename: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const [{ pdf }, { TimesheetDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./timesheet-document"),
      ]);
      const blob = await pdf(<TimesheetDocument {...data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ variant: "destructive", title: "PDF failed", description: e instanceof Error ? e.message : "Error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={go} disabled={busy} type="button">
      <FileText className="h-4 w-4" /> {busy ? "Generating…" : "Print / PDF"}
    </Button>
  );
}

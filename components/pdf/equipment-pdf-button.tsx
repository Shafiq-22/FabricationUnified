"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import type { EquipmentPdfData } from "./equipment-document";

export function EquipmentPdfButton({
  data,
  filename,
}: {
  data: EquipmentPdfData;
  filename: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const [{ pdf }, { EquipmentDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./equipment-document"),
      ]);
      const blob = await pdf(<EquipmentDocument {...data} />).toBlob();
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

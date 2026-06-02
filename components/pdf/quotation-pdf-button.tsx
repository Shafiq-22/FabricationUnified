"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import type { QuotationData } from "./quotation-document";

// Generates the PDF entirely client-side, on demand. @react-pdf/renderer and
// the document are dynamically imported so nothing PDF-related loads on the
// server or until the user clicks.
export function QuotationPdfButton({ data }: { data: QuotationData }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const [{ pdf }, { QuotationDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./quotation-document"),
      ]);
      const blob = await pdf(<QuotationDocument {...data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.job.job_code ?? "quotation"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "PDF generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={generate} disabled={busy} type="button">
      <FileText className="h-4 w-4" />
      {busy ? "Generating…" : "PDF Quotation"}
    </Button>
  );
}

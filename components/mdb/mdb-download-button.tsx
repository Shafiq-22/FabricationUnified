"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import type { MdbDocData } from "./mdb-document";

/**
 * Generates the .docx entirely in the browser, on demand. `docx` and the
 * document builder are dynamically imported so nothing Word-related is loaded
 * on the server or until the user clicks — the same approach the PDF buttons
 * take.
 */
export function MdbDownloadButton({
  data,
  filename,
  label = "Download Word",
  variant = "default",
}: {
  data: MdbDocData;
  filename: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const { buildMdbDocx } = await import("./mdb-document");
      const blob = await buildMdbDocx(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "MDB generated",
        description: `${data.sections.filter((s) => s.status !== "not_applicable").length} section divider(s) written.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Word generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant={variant} onClick={generate} disabled={busy} type="button">
      <FileDown className="h-4 w-4" />
      {busy ? "Generating…" : label}
    </Button>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookText } from "lucide-react";
import { createMdb } from "@/app/(app)/jobs/[id]/mdb/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { MDB_CHAPTERS, MDB_STRUCTURAL_PRESET, MDB_TEMPLATE } from "@/lib/mdb/template";

/**
 * Shown when a job has no MDB yet. The two buttons differ only in where they
 * start you: the structural preset pre-marks the chapters a steel job
 * normally needs, so the first screen is a book to finish rather than 52
 * blank rows to triage. Everything remains editable either way.
 */
export function CreateMdbPanel({ jobId, editable }: { jobId: string; editable: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const create = (preset: "structural" | "all") =>
    start(async () => {
      const res = await createMdb(jobId, preset);
      if (res.error) {
        toast({ variant: "destructive", title: "Could not create the MDB", description: res.error });
      } else {
        toast({
          title: "MDB created",
          description: `${MDB_TEMPLATE.length} sections across ${Object.keys(MDB_CHAPTERS).length} chapters.`,
        });
        router.refresh();
      }
    });

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl border border-border bg-card p-8 text-center">
        <BookText className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-sm font-semibold">No Manufacturing Data Book yet</h2>
        <p className="mx-auto mt-2 max-w-lg text-xs text-muted-foreground">
          The MDB is the dossier handed over on completion — the index of every
          certificate, report and drawing that proves the item was built and tested
          as specified. It is created from the standard {MDB_TEMPLATE.length}-section
          layout and pre-filled from this job and its project, then exported to Word.
        </p>

        {editable ? (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button type="button" disabled={pending} onClick={() => create("structural")}>
                {pending ? "Creating…" : "Create — structural steel preset"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => create("all")}
              >
                Create — all sections pending
              </Button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              The preset marks the {MDB_STRUCTURAL_PRESET.size} sections a typical
              structural job needs as included and the rest not applicable. Both
              options create the same {MDB_TEMPLATE.length} sections — only the
              starting statuses differ, and every one stays editable.
            </p>
          </>
        ) : (
          <p className="mt-5 text-xs text-muted-foreground">
            You do not have permission to create the MDB for this job.
          </p>
        )}
      </div>
    </div>
  );
}

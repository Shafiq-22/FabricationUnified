"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { softDeleteJob } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";

/** Soft-deletes a job from the Jobs list. Administrators only. */
export function DeleteJobButton({
  jobId,
  jobCode,
}: {
  jobId: string;
  jobCode: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      title="Delete job"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        if (!confirm(`Delete job ${jobCode ?? ""}? It is removed from the register.`)) return;
        start(async () => {
          const res = await softDeleteJob(jobId);
          if (res.error) {
            toast({ variant: "destructive", title: "Failed", description: res.error });
            return;
          }
          toast({ title: "Job deleted", description: jobCode ?? undefined });
          router.refresh();
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

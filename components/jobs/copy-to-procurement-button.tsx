"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCopy } from "lucide-react";
import { copyOrderListToProcurement } from "@/app/(app)/jobs/[id]/roughsheet/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";

export function CopyToProcurementButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const res = await copyOrderListToProcurement(jobId);
      if (res.error) {
        toast({ variant: "destructive", title: "Copy failed", description: res.error });
      } else {
        toast({
          title: "Copied to Procurement",
          description: `${res.count} material request line(s) created.`,
        });
        router.push("/procurement");
      }
    });

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={pending} type="button">
      <ClipboardCopy className="h-4 w-4" />
      {pending ? "Copying…" : "Copy to Job Material Request"}
    </Button>
  );
}

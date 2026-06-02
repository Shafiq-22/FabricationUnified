"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateJobStatus } from "@/app/(app)/jobs/actions";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";
import { JOB_STATUSES } from "@/lib/types";

export function JobStatusControl({
  jobId,
  status,
  editable,
}: {
  jobId: string;
  status: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [current, setCurrent] = useState(status);
  const [pending, start] = useTransition();

  // Realtime: reflect status changes made by other users.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`job-status-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_status_events",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          const next = (payload.new as { status?: string }).status;
          if (next) {
            setCurrent(next);
            router.refresh();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, router]);

  if (!editable) return <JobStatusBadge status={current} showLabel />;

  const onChange = (value: string) => {
    setCurrent(value);
    start(async () => {
      const res = await updateJobStatus(jobId, value);
      if (res?.error) {
        toast({ variant: "destructive", title: "Failed", description: res.error });
        setCurrent(status);
      } else {
        toast({ title: "Status updated" });
        router.refresh();
      }
    });
  };

  return (
    <Select value={current} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-8 w-[160px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {JOB_STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

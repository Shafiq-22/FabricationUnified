"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { updateJobDetails } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";
import type { JobView } from "@/lib/types";

const FIELDS: { key: keyof JobView; label: string; type?: string }[] = [
  { key: "company_job_code", label: "Company Job Code" },
  { key: "quotation_ref", label: "Quotation Ref" },
  { key: "requisition_no", label: "Requisition No" },
  { key: "lpo_ref", label: "LPO Ref" },
  { key: "inbound_outpass", label: "Inbound Outpass" },
  { key: "exit_outpass", label: "Exit Outpass" },
  { key: "completion_date", label: "Completion Date", type: "date" },
];

export function JobMetaForm({ job, editable }: { job: JobView; editable: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(() => {
    const init: Record<string, string> = {};
    FIELDS.forEach((f) => (init[f.key as string] = (job[f.key] as string) ?? ""));
    init.comments = (job.comments as string) ?? "";
    return init;
  });

  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const save = () =>
    start(async () => {
      const res = await updateJobDetails(job.id as string, form);
      if (res?.error) toast({ variant: "destructive", title: "Save failed", description: res.error });
      else {
        toast({ title: "Job details saved" });
        router.refresh();
      }
    });

  return (
    <div className="border border-border bg-card">
      <h3 className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Document References
      </h3>
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 lg:grid-cols-4">
        {FIELDS.map((f) => (
          <div key={f.key as string} className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">{f.label}</Label>
            <Input
              type={f.type ?? "text"}
              value={form[f.key as string]}
              disabled={!editable}
              onChange={(e) => set(f.key as string, e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        ))}
        <div className="col-span-2 space-y-1 md:col-span-3 lg:col-span-4">
          <Label className="text-[10px] uppercase text-muted-foreground">Notes</Label>
          <Textarea
            value={form.comments}
            disabled={!editable}
            onChange={(e) => set("comments", e.target.value)}
            rows={2}
            className="text-xs"
          />
        </div>
      </div>
      {editable && (
        <div className="flex justify-end border-t border-border p-3">
          <Button size="sm" onClick={save} disabled={pending} type="button">
            <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save Details"}
          </Button>
        </div>
      )}
    </div>
  );
}

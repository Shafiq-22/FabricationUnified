"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, AlertTriangle } from "lucide-react";
import { createJob, type ActionState } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JOB_STATUSES } from "@/lib/types";

const initial: ActionState = { error: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create Job"}
    </Button>
  );
}

export function NewJobDialog({
  sites,
}: {
  sites: { id: string; code: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createJob, initial);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          New Job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Job</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="site_id">Site *</Label>
              <Select name="site_id" required>
                <SelectTrigger id="site_id">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-mono">{s.code}</span> — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="description">Description *</Label>
              <Input id="description" name="description" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue="quotation">
                <SelectTrigger id="status">
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start Date</Label>
              <Input id="start_date" name="start_date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" placeholder="e.g. nos / kg / m" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantity</Label>
              <Input id="qty" name="qty" type="number" step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company_job_code">Company Job Code</Label>
              <Input id="company_job_code" name="company_job_code" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quotation_ref">Quotation Ref</Label>
              <Input id="quotation_ref" name="quotation_ref" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote_before_margin">Quote (before margin)</Label>
              <Input
                id="quote_before_margin"
                name="quote_before_margin"
                type="number"
                step="0.01"
                placeholder="AED"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="margin">Margin %</Label>
              <Input
                id="margin"
                name="margin"
                type="number"
                step="0.1"
                defaultValue="15"
              />
            </div>
          </div>

          {state.error && (
            <p className="flex items-center gap-2 border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

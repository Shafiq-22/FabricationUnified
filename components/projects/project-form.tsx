"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Save, Search } from "lucide-react";
import { createProjectWithJobs } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/hooks/use-toast";
import { PROJECT_STATUSES, statusMeta } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export interface SelectableJob {
  id: string;
  job_code: string;
  description: string | null;
  site_code: string | null;
  status: string | null;
}

export function ProjectForm({
  clientOptions,
  siteOptions,
  availableJobs,
}: {
  clientOptions: { value: string; label: string }[];
  siteOptions: { value: string; label: string }[];
  availableJobs: SelectableJob[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, string>>({
    name: "",
    client_id: "none",
    site_id: "none",
    status: "rfq",
    contract_value: "",
    start_date: "",
    target_completion: "",
    actual_completion: "",
    notes: "",
  });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [jobQuery, setJobQuery] = useState("");

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const visibleJobs = useMemo(() => {
    const term = jobQuery.trim().toLowerCase();
    if (!term) return availableJobs;
    return availableJobs.filter((j) =>
      [j.job_code, j.description, j.site_code].some((f) =>
        (f ?? "").toLowerCase().includes(term),
      ),
    );
  }, [availableJobs, jobQuery]);

  const toggleJob = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createProjectWithJobs(values, Array.from(picked));
      if (res.error && !res.id) {
        setError(res.error);
        return;
      }
      if (res.error) toast({ variant: "destructive", title: "Partly saved", description: res.error });
      else toast({ title: "Project created", description: `${picked.size} job(s) attached` });
      router.push(res.id ? `/projects/${res.id}` : "/projects");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-6">
      <div className="border border-border bg-card">
        <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Project details
        </p>
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Project Name" required className="sm:col-span-2 lg:col-span-4">
            <Input
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              required
              placeholder="e.g. Marina Tower — Steel Staircases"
            />
          </Field>

          <Field label="Client">
            <Picker
              value={values.client_id}
              onChange={(v) => set("client_id", v)}
              options={clientOptions}
            />
          </Field>
          <Field label="Site">
            <Picker
              value={values.site_id}
              onChange={(v) => set("site_id", v)}
              options={siteOptions}
            />
          </Field>
          <Field label="Status" required>
            <Select value={values.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Contract Value (AED)">
            <Input
              type="number"
              step="0.01"
              value={values.contract_value}
              onChange={(e) => set("contract_value", e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Field label="Start Date">
            <Input
              type="date"
              value={values.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </Field>
          <Field label="Target Completion">
            <Input
              type="date"
              value={values.target_completion}
              onChange={(e) => set("target_completion", e.target.value)}
            />
          </Field>
          <Field label="Actual Completion">
            <Input
              type="date"
              value={values.actual_completion}
              onChange={(e) => set("actual_completion", e.target.value)}
            />
          </Field>
          <div />

          <Field label="Notes" className="sm:col-span-2 lg:col-span-4">
            <Textarea
              rows={2}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Attach jobs
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Only jobs that are not already part of another project are listed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{picked.size} selected</span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={jobQuery}
                onChange={(e) => setJobQuery(e.target.value)}
                placeholder="Search jobs…"
                className="h-8 w-56 pl-7 text-xs"
              />
            </div>
          </div>
        </div>

        {availableJobs.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">
            Every job already belongs to a project. You can create the project now and
            attach jobs later from the project page.
          </p>
        ) : (
          <div className="max-h-[26rem] overflow-y-auto">
            {visibleJobs.map((j) => (
              <label
                key={j.id}
                className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/50"
              >
                <Checkbox
                  checked={picked.has(j.id)}
                  onCheckedChange={() => toggleJob(j.id)}
                />
                <span className="code-chip text-steel">{j.job_code}</span>
                <span className="min-w-0 flex-1 truncate text-xs">
                  {j.description ?? "—"}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {j.site_code ?? "—"}
                </span>
                <Badge variant={statusMeta(j.status).badge}>
                  {statusMeta(j.status).label}
                </Badge>
              </label>
            ))}
            {visibleJobs.length === 0 && (
              <p className="p-6 text-center text-xs text-muted-foreground">
                No unassigned jobs match that search.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-2 border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Create Project"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Link>
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">
        {label}
        {required && " *"}
      </Label>
      {children}
    </div>
  );
}

function Picker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— None —</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

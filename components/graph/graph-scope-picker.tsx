"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

export function GraphScopePicker({
  projects,
  jobs,
  projectId,
  jobId,
}: {
  projects: { value: string; label: string }[];
  jobs: { value: string; label: string }[];
  projectId?: string;
  jobId?: string;
}) {
  const router = useRouter();

  const go = (key: "projectId" | "jobId", value: string) => {
    const sp = new URLSearchParams();
    // Scoping to a job supersedes the project filter, and vice versa.
    if (value !== ALL) sp.set(key, value);
    router.push(`/graph${sp.toString() ? `?${sp}` : ""}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={projectId ?? ALL} onValueChange={(v) => go("projectId", v)}>
        <SelectTrigger className="h-8 w-[220px] text-xs">
          <SelectValue placeholder="All projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.value} value={p.value} className="text-xs">
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={jobId ?? ALL} onValueChange={(v) => go("jobId", v)}>
        <SelectTrigger className="h-8 w-[200px] font-mono text-xs">
          <SelectValue placeholder="All jobs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All jobs</SelectItem>
          {jobs.map((j) => (
            <SelectItem key={j.value} value={j.value} className="font-mono text-xs">
              {j.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(projectId || jobId) && (
        <Button variant="ghost" size="sm" onClick={() => router.push("/graph")}>
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}

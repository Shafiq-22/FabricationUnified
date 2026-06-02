"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Search } from "lucide-react";
import { createSite, updateSite, toggleSiteActive } from "@/app/(app)/sites/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";
import type { Site } from "@/lib/types";

const fields: FieldDef[] = [
  { key: "code", label: "Code", required: true },
  { key: "name", label: "Name", required: true, colSpan: 2 },
  { key: "location", label: "Location" },
];

export function SitesManager({ sites }: { sites: Site[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return sites;
    return sites.filter(
      (s) =>
        s.code.toLowerCase().includes(term) || s.name.toLowerCase().includes(term),
    );
  }, [q, sites]);

  const toggle = (id: string, active: boolean) =>
    start(async () => {
      const res = await toggleSiteActive(id, active);
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else router.refresh();
    });

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code or name…"
            className="h-8 w-64 pl-7 text-xs"
          />
        </div>
        <RecordFormDialog
          title="New Site"
          fields={fields}
          onSubmit={createSite}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" /> Add Site
            </Button>
          }
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="code-chip text-steel">{s.code}</TableCell>
              <TableCell className="text-sm">{s.name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{s.location ?? "—"}</TableCell>
              <TableCell>
                {s.active ? (
                  <Badge variant="com">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <RecordFormDialog
                    title="Edit Site"
                    fields={fields}
                    initial={s as unknown as Record<string, unknown>}
                    onSubmit={(v) => updateSite(s.id, v)}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={pending}
                    onClick={() => toggle(s.id, !s.active)}
                  >
                    {s.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

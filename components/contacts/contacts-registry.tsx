"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Search, Mail, Phone, Trash2 } from "lucide-react";
import {
  createContact,
  updateContact,
  toggleContactActive,
  deleteContact,
} from "@/app/(app)/contacts/actions";
import { RecordFormDialog, type FieldDef } from "@/components/records/record-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";
import { CONTACT_ROLES, contactRoleLabel } from "@/lib/types";
import type { Contact } from "./types";

export function ContactsRegistry({
  contacts,
  siteNames,
  siteOptions,
  assignmentCounts,
  canEdit,
  canDelete = false,
}: {
  contacts: Contact[];
  siteNames: Record<string, string>;
  siteOptions: { value: string; label: string }[];
  assignmentCounts: Record<string, number>;
  canEdit: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [pending, start] = useTransition();

  const fields: FieldDef[] = useMemo(
    () => [
      { key: "name", label: "Name", required: true },
      {
        key: "role",
        label: "Role",
        type: "select",
        required: true,
        options: CONTACT_ROLES.map((r) => ({ value: r.value, label: r.label })),
      },
      { key: "organisation", label: "Organisation / Department", colSpan: 2 },
      {
        key: "site_id",
        label: "Site",
        type: "select",
        options: siteOptions,
        colSpan: 2,
      },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "notes", label: "Notes", colSpan: 2 },
    ],
    [siteOptions],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (role !== "all" && c.role !== role) return false;
      if (!term) return true;
      return [c.name, c.organisation, c.email, c.phone, siteNames[c.site_id ?? ""]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [contacts, q, role, siteNames]);

  const toggle = (id: string, active: boolean) =>
    start(async () => {
      const res = await toggleContactActive(id, active);
      if (res.error)
        toast({ variant: "destructive", title: "Failed", description: res.error });
      else router.refresh();
    });

  const remove = (id: string, name: string) => {
    if (!confirm(`Delete contact "${name}"? Deactivating keeps them out of the pickers but preserves history.`))
      return;
    start(async () => {
      const res = await deleteContact(id);
      if (res.error)
        toast({ variant: "destructive", title: "Could not delete", description: res.error });
      else {
        toast({ title: "Deleted", description: name });
        router.refresh();
      }
    });
  };

  return (
    <div className="border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, organisation, site…"
              className="h-8 w-72 pl-7 text-xs"
            />
          </div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {CONTACT_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <RecordFormDialog
            title="New Contact"
            fields={fields}
            initial={{ role: "other" }}
            onSubmit={createContact}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Add Contact
              </Button>
            }
          />
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Name</TableHead>
            <TableHead className="text-center">Role</TableHead>
            <TableHead className="text-center">Organisation</TableHead>
            <TableHead className="text-center">Site</TableHead>
            <TableHead className="text-center">Contact</TableHead>
            <TableHead className="w-20 text-center">Jobs</TableHead>
            <TableHead className="w-24 text-center">Status</TableHead>
            {canEdit && <TableHead className="w-28" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={canEdit ? 8 : 7}
                className="py-8 text-center text-xs text-muted-foreground"
              >
                No contacts yet. Add project in-charges, requisitioners and procurement
                staff here — welders and foremen are pulled from the timesheets
                automatically.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="text-sm font-medium">{c.name}</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline">{contactRoleLabel(c.role)}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {c.organisation ?? "—"}
              </TableCell>
              <TableCell className="text-xs">
                {c.site_id ? (
                  <span className="code-chip text-steel">{siteNames[c.site_id] ?? "—"}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-xs">
                <div className="flex flex-col gap-0.5">
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Mail className="h-3 w-3" />
                      {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {c.phone}
                    </span>
                  )}
                  {!c.email && !c.phone && <span className="text-muted-foreground">—</span>}
                </div>
              </TableCell>
              <TableCell className="text-center text-xs tabular-nums">
                {assignmentCounts[c.id] ?? 0}
              </TableCell>
              <TableCell className="text-center">
                {c.active ? (
                  <Badge variant="com">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </TableCell>
              {canEdit && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    <RecordFormDialog
                      title="Edit Contact"
                      fields={fields}
                      initial={c as unknown as Record<string, unknown>}
                      onSubmit={(v) => updateContact(c.id, v)}
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
                      onClick={() => toggle(c.id, !c.active)}
                    >
                      {c.active ? "Deactivate" : "Activate"}
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => remove(c.id, c.name)}
                        title="Delete contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

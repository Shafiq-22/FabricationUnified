"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Paperclip, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  createCertificate,
  updateCertificate,
  deleteCertificate,
} from "@/app/(app)/qa/certificates-actions";
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
import { fmtDate } from "@/lib/date";
import { certRenewalDraft, certExpiryNoticeDraft } from "@/lib/email-draft";
import { DocumentUpload } from "@/components/documents/document-upload";
import { CertificateFilesDialog, type CertFile } from "@/components/qa/certificate-files";

export interface CertificateRow {
  id: string;
  personnel_id: string | null;
  ho_no: string | null;
  name: string;
  position: string | null;
  certificate_no: string | null;
  issued_on: string | null;
  renewed_on: string | null;
  expires_on: string | null;
  site_id: string | null;
  issuer: string | null;
  notes: string | null;
}

/** Days until expiry; negative once it has lapsed, null with no date. */
function daysLeft(expires: string | null): number | null {
  if (!expires) return null;
  const d = new Date(expires);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export function CertificatesManager({
  rows,
  filesByCert,
  siteNames,
  siteOptions,
  personnelOptions,
  warnDays,
  notifyEmail,
  senderName,
  companyName,
  departmentName,
  canEdit,
  canDelete,
}: {
  rows: CertificateRow[];
  /** Documents attached to each certificate — the same rows the Documents
   *  tab lists, pointed at rather than copied. */
  filesByCert: Record<string, CertFile[]>;
  siteNames: Record<string, string>;
  siteOptions: { value: string; label: string }[];
  personnelOptions: { value: string; label: string }[];
  /** How far ahead a certificate counts as "expiring", from Settings. */
  warnDays: number;
  notifyEmail: string;
  senderName: string;
  companyName: string;
  departmentName: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const [pending, start] = useTransition();

  const fields: FieldDef[] = useMemo(
    () => [
      {
        key: "personnel_id",
        label: "Personnel record",
        type: "select",
        options: [{ value: "none", label: "— Not on the roster —" }, ...personnelOptions],
        colSpan: 2,
      },
      { key: "name", label: "Name", required: true },
      { key: "ho_no", label: "HO Number" },
      { key: "position", label: "Position", placeholder: "1G / 3G / 6G…" },
      { key: "certificate_no", label: "Certificate No" },
      { key: "issued_on", label: "Date of Certificate", type: "date" },
      { key: "renewed_on", label: "Date of Renewal", type: "date" },
      { key: "expires_on", label: "Date of Expiry", type: "date" },
      {
        key: "site_id",
        label: "Site",
        type: "select",
        options: [{ value: "none", label: "— Unassigned —" }, ...siteOptions],
      },
      { key: "issuer", label: "Certifying body", colSpan: 2 },
      { key: "notes", label: "Notes", colSpan: 2 },
    ],
    [siteOptions, personnelOptions],
  );

  const decorated = useMemo(
    () => rows.map((r) => ({ ...r, left: daysLeft(r.expires_on) })),
    [rows],
  );

  const expiring = useMemo(
    () => decorated.filter((r) => r.left != null && r.left <= warnDays),
    [decorated, warnDays],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return decorated.filter((r) => {
      if (onlyExpiring && !(r.left != null && r.left <= warnDays)) return false;
      if (!term) return true;
      return [r.name, r.ho_no, r.position, r.certificate_no, siteNames[r.site_id ?? ""]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [decorated, q, onlyExpiring, warnDays, siteNames]);

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteCertificate(id);
      if (res.error) toast({ variant: "destructive", title: "Failed", description: res.error });
      else {
        toast({ title: "Certificate deleted" });
        router.refresh();
      }
    });

  const renewalHref = certRenewalDraft({
    companyName,
    departmentName,
    senderName,
    welders: expiring.map((r) => ({
      name: r.name,
      hoNo: r.ho_no,
      position: r.position,
      certificateNo: r.certificate_no,
      expiresOn: r.expires_on,
    })),
  });

  const badgeFor = (left: number | null) => {
    if (left == null) return { variant: "secondary" as const, label: "No date" };
    if (left < 0) return { variant: "hal" as const, label: `Expired ${-left}d` };
    if (left <= warnDays) return { variant: "qtn" as const, label: `${left}d left` };
    return { variant: "com" as const, label: "Valid" };
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, HO number, position…"
              className="h-8 w-72 pl-7 text-xs"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={onlyExpiring}
              onChange={(e) => setOnlyExpiring(e.target.checked)}
              className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
            />
            Only expiring or expired
          </label>
          <span className="text-xs text-muted-foreground">
            {expiring.length} within {warnDays} days
          </span>
        </div>
        <div className="flex items-center gap-2">
          {expiring.length > 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <a href={renewalHref}>
                <Mail className="h-3.5 w-3.5" /> Draft renewal enquiry
              </a>
            </Button>
          )}
          {canEdit && (
            <RecordFormDialog
              title="New Welder Certificate"
              fields={fields}
              onSubmit={createCertificate}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Add Certificate
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">S. No</TableHead>
              <TableHead>HO Number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Date of Certificate</TableHead>
              <TableHead>Date of Renewal</TableHead>
              <TableHead>Date of Expiry</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="w-24">Files</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-xs text-muted-foreground">
                  {rows.length === 0
                    ? "No welder certificates recorded yet."
                    : "No certificates match that search."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r, i) => {
              const b = badgeFor(r.left);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-center tabular text-xs">{i + 1}</TableCell>
                  <TableCell className="text-center font-mono text-xs">{r.ho_no ?? "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {r.position ?? "—"}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {fmtDate(r.issued_on)}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {fmtDate(r.renewed_on)}
                  </TableCell>
                  <TableCell className="text-center text-xs">{fmtDate(r.expires_on)}</TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {r.site_id ? siteNames[r.site_id] ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <CertificateFilesDialog
                      certificateName={r.name}
                      files={filesByCert[r.id] ?? []}
                      canDelete={canDelete}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={b.variant}>{b.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {r.left != null && r.left <= warnDays && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={
                            notifyEmail
                              ? `Draft expiry notice to ${notifyEmail}`
                              : "Draft expiry notice (set the address in Settings to pre-fill it)"
                          }
                          asChild
                        >
                          <a
                            href={certExpiryNoticeDraft({
                              to: notifyEmail || null,
                              companyName,
                              departmentName,
                              senderName,
                              welderName: r.name,
                              hoNo: r.ho_no,
                              position: r.position,
                              expiresOn: r.expires_on,
                              daysLeft: r.left,
                            })}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {canEdit && (
                        <DocumentUpload
                          jobOptions={[]}
                          certificateId={r.id}
                          defaultDocType="certificate"
                          label=""
                          triggerVariant="ghost"
                          triggerClassName="h-7 w-7 p-0"
                          icon={<Paperclip className="h-3.5 w-3.5" />}
                        />
                      )}
                      {canEdit && (
                        <RecordFormDialog
                          title="Edit Welder Certificate"
                          fields={fields}
                          initial={r as unknown as Record<string, unknown>}
                          onSubmit={(v) => updateCertificate(r.id, v)}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={pending}
                          onClick={() => {
                            if (confirm(`Delete the certificate for ${r.name}?`)) remove(r.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

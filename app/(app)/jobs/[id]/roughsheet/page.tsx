import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  RoughItemsEditor,
  RoughPlatesEditor,
} from "@/components/jobs/rough-sheet-editors";
import { CopyToProcurementButton } from "@/components/jobs/copy-to-procurement-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function RoughSheetPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await getProfile();
  const editable = profile.role_tier >= 2;
  const supabase = createClient();

  const { data: job } = await supabase
    .from("jobs_view")
    .select("id, job_code, description")
    .eq("id", params.id)
    .maybeSingle();
  if (!job) notFound();

  const [{ data: items }, { data: plates }, { data: agg }, { data: plateAgg }] =
    await Promise.all([
      supabase.from("rough_sheet_items").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("cut_list_plates").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("rough_sheet_aggregated").select("*").eq("job_id", params.id),
      supabase.from("cut_list_plates_aggregated").select("*").eq("job_id", params.id),
    ]);

  return (
    <div className="pb-10">
      <PageHeader title={`Rough Sheet — ${job.job_code}`} description={job.description ?? undefined}>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/jobs/${params.id}/worksheet`}>
            <ArrowLeft className="h-4 w-4" /> Worksheet
          </Link>
        </Button>
        {editable && <CopyToProcurementButton jobId={params.id} />}
      </PageHeader>

      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <RoughItemsEditor jobId={params.id} editable={editable} rows={items ?? []} />

        <section className="panel-surface">
          <h3 className="border-b border-panel-border px-3 py-2 text-xs font-semibold uppercase tracking-wide">
            Order List (Aggregated)
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profile</TableHead>
                <TableHead>Dimension</TableHead>
                <TableHead className="text-right">Total Len (m)</TableHead>
                <TableHead className="text-right">Theoretical</TableHead>
                <TableHead className="text-right">Order Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(agg ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-xs text-panel-foreground/50">
                    Save cut-list rows to compute the order list.
                  </TableCell>
                </TableRow>
              )}
              {(agg ?? []).map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{a.profile_type}</TableCell>
                  <TableCell className="text-xs">{a.dimension}</TableCell>
                  <TableCell className="text-right text-xs">{a.total_length}</TableCell>
                  <TableCell className="text-right text-xs">{a.theoretical_qty}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-amber">
                    {a.order_qty}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <RoughPlatesEditor jobId={params.id} editable={editable} rows={plates ?? []} />

        <section className="panel-surface">
          <h3 className="border-b border-panel-border px-3 py-2 text-xs font-semibold uppercase tracking-wide">
            Plate Order List (Aggregated)
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thickness</TableHead>
                <TableHead>Sheet</TableHead>
                <TableHead className="text-right">Area Used (m²)</TableHead>
                <TableHead className="text-right">Sheets Req.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plateAgg ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-xs text-panel-foreground/50">
                    Save plate rows to compute sheets required.
                  </TableCell>
                </TableRow>
              )}
              {(plateAgg ?? []).map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{p.thickness_mm} mm</TableCell>
                  <TableCell className="font-mono text-xs">{p.plate_size}</TableCell>
                  <TableCell className="text-right text-xs">
                    {p.area_used != null ? Number(p.area_used).toFixed(3) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold text-amber">
                    {p.sheets_required ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  );
}

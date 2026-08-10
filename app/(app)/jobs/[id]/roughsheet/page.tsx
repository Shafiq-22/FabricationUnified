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
import { ImportDialog } from "@/components/jobs/import-dialog";
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

  const [{ data: items }, { data: plates }, { data: agg }, { data: plateAgg }, { data: stock }] =
    await Promise.all([
      supabase.from("rough_sheet_items").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("cut_list_plates").select("*").eq("job_id", params.id).order("seq_no"),
      supabase.from("rough_sheet_aggregated").select("*").eq("job_id", params.id),
      supabase.from("cut_list_plates_aggregated").select("*").eq("job_id", params.id),
      supabase
        .from("inventory_items_view")
        .select("description, material_grade, dimensions, quantity_on_hand, unit, item_type")
        .eq("active", true),
    ]);

  // Match aggregated order lines against stock by normalised dimension so an
  // engineer sees what is already on the shelf (incl. remnants) before ordering.
  type StockRow = {
    description: string | null;
    material_grade: string | null;
    dimensions: string | null;
    quantity_on_hand: number | null;
    unit: string | null;
    item_type: string | null;
  };
  const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[\s*x×]/g, "");
  const stockRows = (stock ?? []) as StockRow[];
  const stockFor = (dimension: string | null) => {
    const d = norm(dimension);
    if (!d) return null;
    const hits = stockRows.filter(
      (s) => norm(s.dimensions) === d || (d.length > 2 && norm(s.description).includes(d)),
    );
    if (hits.length === 0) return null;
    return {
      qty: hits.reduce((sum, h) => sum + Number(h.quantity_on_hand ?? 0), 0),
      unit: hits[0].unit ?? "",
      isRemnant: hits.some((h) => h.item_type === "remnant"),
    };
  };

  return (
    <div className="pb-10">
      <PageHeader title={`Rough Sheet — ${job.job_code}`} description={job.description ?? undefined}>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/jobs/${params.id}/worksheet`}>
            <ArrowLeft className="h-4 w-4" /> Worksheet
          </Link>
        </Button>
        {editable && (
          <ImportDialog
            jobId={params.id}
            target="rough_sheet_items"
            label="Import Cut List"
            allowDstv
          />
        )}
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
                <TableHead className="text-center">Profile</TableHead>
                <TableHead className="text-center">Dimension</TableHead>
                <TableHead className="text-center">Grade</TableHead>
                <TableHead className="text-center">Total Len (m)</TableHead>
                <TableHead className="text-center">Theoretical</TableHead>
                <TableHead className="text-center">Order Qty</TableHead>
                <TableHead className="text-center">In Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(agg ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-xs text-panel-foreground/50">
                    Save cut-list rows to compute the order list.
                  </TableCell>
                </TableRow>
              )}
              {(agg ?? []).map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{a.profile_type}</TableCell>
                  <TableCell className="text-xs">{a.dimension}</TableCell>
                  <TableCell className="text-center font-mono text-xs">{a.grade ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">{a.total_length}</TableCell>
                  <TableCell className="text-right text-xs">{a.theoretical_qty}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-amber">
                    {a.order_qty}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {(() => {
                      const s = stockFor(a.dimension);
                      if (!s || s.qty <= 0)
                        return <span className="text-panel-foreground/40">—</span>;
                      return (
                        <span
                          className={s.isRemnant ? "font-semibold text-steel" : "font-semibold"}
                          title={s.isRemnant ? "Includes remnant stock" : "Available in stock"}
                        >
                          {s.qty} {s.unit}
                        </span>
                      );
                    })()}
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
                <TableHead className="text-center">Thickness</TableHead>
                <TableHead className="text-center">Sheet</TableHead>
                <TableHead className="text-center">Grade</TableHead>
                <TableHead className="text-center">Area Used (m²)</TableHead>
                <TableHead className="text-center">Sheets Req.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plateAgg ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-xs text-panel-foreground/50">
                    Save plate rows to compute sheets required.
                  </TableCell>
                </TableRow>
              )}
              {(plateAgg ?? []).map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{p.thickness_mm} mm</TableCell>
                  <TableCell className="font-mono text-xs" title={p.sheet_area ? `${p.sheet_area} m² per sheet` : "Sheet size not recognised"}>
                    {p.plate_size}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">{p.grade ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">
                    {p.area_used != null ? Number(p.area_used).toFixed(3) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold text-amber">
                    {p.sheets_required ?? (
                      <span
                        className="font-normal text-panel-foreground/50"
                        title="Enter the sheet size as width x length in metres, e.g. 2x6"
                      >
                        size?
                      </span>
                    )}
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

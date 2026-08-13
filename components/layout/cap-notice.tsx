/**
 * List queries are capped so a single page cannot pull the whole table. The
 * cap is silent by default, which is the dangerous part — a list that stops
 * at 2,000 looks exactly like a list that has 2,000 rows. This says so.
 *
 * `total` comes from PostgREST's exact count, so the figure is the real one
 * rather than a guess.
 */
export function CapNotice({
  shown,
  total,
  hint = "Narrow the list with the filters above.",
}: {
  shown: number;
  total: number | null | undefined;
  hint?: string;
}) {
  if (total == null || shown >= total) return null;
  return (
    <p className="border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-muted-foreground">
      Showing the first <span className="font-semibold text-foreground">{shown.toLocaleString()}</span>{" "}
      of <span className="font-semibold text-foreground">{total.toLocaleString()}</span> records. {hint}
    </p>
  );
}

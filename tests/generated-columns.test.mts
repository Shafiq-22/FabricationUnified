/**
 * Guard against writing to GENERATED ALWAYS columns.
 *
 * Postgres rejects the whole statement with
 *   cannot insert a non-DEFAULT value into column "total_price"
 * and neither `tsc` nor `next build` can see it — the Job Material Request
 * button was broken on all three worksheet tabs for exactly this reason.
 *
 * The list mirrors `information_schema.columns.is_generated = 'ALWAYS'`; add
 * to it whenever a migration adds a generated column.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const GENERATED = [
  "total_price",
  "total_cost",
  "total_hours",
  "total_area_m2",
  "total_length",
  "order_qty",
  "month_year",
  "time_to_deliver_days",
];

/** Every server-action module; those are the only places that write. */
function actionFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) actionFiles(path, found);
    else if (entry === "actions.ts" || entry.endsWith("-actions.ts")) found.push(path);
  }
  return found;
}

test("no server action writes a generated column", () => {
  const offenders: string[] = [];

  for (const file of actionFiles("app")) {
    const src = readFileSync(file, "utf8");
    src.split("\n").forEach((line, i) => {
      // An object-literal key is a write; a read (`r.total_cost`, a string in
      // a `.select()`, a comment) is not.
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      for (const col of GENERATED) {
        if (new RegExp(`(^|[{,\\s])${col}\\s*:`).test(line)) {
          offenders.push(`${file}:${i + 1} writes ${col}`);
        }
      }
    });
  }

  assert.deepEqual(offenders, [], offenders.join("\n"));
});

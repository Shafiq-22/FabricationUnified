/**
 * Excel / CSV sheet reader for BOM & MTO imports.
 *
 * Runs in the browser (exceljs is dynamically imported by the caller) so large
 * workbooks never pass through the server. Column mapping is deterministic
 * header matching — no inference beyond string similarity.
 */
export interface SheetData {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

/** Normalise a header for matching: lowercase, alphanumerics only. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Guess which sheet column feeds a target field.
 * Candidates are tried in order: exact match first, then "contains".
 */
export function guessColumn(headers: string[], candidates: string[]): number {
  const H = headers.map(norm);
  for (const c of candidates) {
    const i = H.indexOf(norm(c));
    if (i !== -1) return i;
  }
  for (const c of candidates) {
    const n = norm(c);
    const i = H.findIndex((h) => h.includes(n) && n.length > 2);
    if (i !== -1) return i;
  }
  return -1;
}

/** Header synonyms per importable field. */
export const COLUMN_HINTS: Record<string, string[]> = {
  material_name: ["material", "description", "item", "material description", "desc", "product"],
  item_name: ["item", "description", "consumable", "material", "desc"],
  profile_type: ["profile", "section", "profile type", "type", "shape"],
  dimension: ["dimension", "size", "dimensions", "section size"],
  length_m: ["length", "length m", "length (m)", "len", "cut length"],
  unit: ["unit", "uom", "units"],
  qty: ["qty", "quantity", "nos", "no", "count", "pcs"],
  unit_cost: ["unit cost", "rate", "price", "unit price", "cost"],
};

export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[, ]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function toText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    // exceljs rich text / formula results
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof o.text === "string") return o.text;
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.result !== undefined) return String(o.result);
    return "";
  }
  return String(v).trim();
}

/** Parse a CSV string (handles quoted fields and embedded commas/newlines). */
export function parseCsv(text: string): SheetData {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = (nonEmpty[0] ?? []).map((h) => h.trim());
  return { name: "CSV", headers, rows: nonEmpty.slice(1) };
}

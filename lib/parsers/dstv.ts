/**
 * Minimal DSTV (NC1) header parser.
 *
 * DSTV is a fixed-format text spec: the ST block holds the part header, one
 * value per line, in a defined order. We only read the header — that is what a
 * cut list needs (profile, grade, length, quantity) — and deliberately ignore
 * the hole/contour blocks (BO, AK, IK, SI...), which describe machining rather
 * than material take-off.
 *
 * Header order after `ST` (per the standard):
 *   1 order id · 2 drawing id · 3 phase id · 4 piece id · 5 steel grade
 *   6 quantity · 7 profile · 8 code profile · 9 length · 10 saw length
 *   11 web height · 12 flange width ...
 */
export interface DstvPart {
  piece_mark: string;
  profile_type: string;
  material_grade: string;
  length_m: number;
  qty: number;
  source_file: string;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

function cleanLine(raw: string): string {
  // Strip inline comments and the leading two-space data indent.
  const noComment = raw.split("**")[0];
  return noComment.trim();
}

/** Parse one .nc/.nc1 file's ST header. Returns null if it isn't DSTV. */
export function parseDstv(text: string, fileName: string): DstvPart | null {
  const lines = text.split(/\r?\n/).map(cleanLine);
  const stIndex = lines.findIndex((l) => l === "ST");
  if (stIndex === -1) return null;

  // Collect header values until the next block marker (two uppercase letters).
  const values: string[] = [];
  for (let i = stIndex + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l === "") continue;
    if (/^[A-Z]{2}$/.test(l)) break; // next block (BO, AK, EN, ...)
    values.push(l);
  }
  if (values.length < 9) return null;

  const pieceMark = values[3] || values[1] || fileName.replace(/\.[^.]+$/, "");
  const grade = values[4] ?? "";
  const qtyRaw = values[5] ?? "1";
  const profile = values[6] ?? "";
  const lengthRaw = values[8] ?? "0";

  const qty = NUMERIC.test(qtyRaw) ? Math.max(1, Math.round(Number(qtyRaw))) : 1;
  // DSTV lengths are millimetres; the cut list stores metres.
  const lengthMm = NUMERIC.test(lengthRaw) ? Number(lengthRaw) : 0;

  return {
    piece_mark: pieceMark,
    profile_type: profile,
    material_grade: grade,
    length_m: Number((lengthMm / 1000).toFixed(3)),
    qty,
    source_file: fileName,
  };
}

/** Parse many DSTV files at once, skipping any that aren't valid. */
export function parseDstvFiles(files: { name: string; text: string }[]): DstvPart[] {
  return files
    .map((f) => parseDstv(f.text, f.name))
    .filter((p): p is DstvPart => p !== null);
}

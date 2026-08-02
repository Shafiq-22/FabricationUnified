/** Private Supabase Storage bucket holding all uploaded documents. */
export const DOCUMENTS_BUCKET = "documents";

/** Storage-safe object key: <jobOrGeneral>/<timestamp>-<sanitised filename>. */
export function documentObjectPath(jobId: string | null | undefined, filename: string) {
  const safe = filename.replace(/[^\w.\-]+/g, "_").slice(-120);
  const prefix = jobId && jobId !== "none" ? jobId : "general";
  return `${prefix}/${Date.now()}-${safe}`;
}

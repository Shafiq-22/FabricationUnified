/**
 * Builds `mailto:` drafts. Nothing is sent from the app — the link opens the
 * user's own mail client with the message pre-filled, so it goes out from
 * their mailbox with their signature and stays in their sent items.
 */

export interface DraftLine {
  item: string;
  qty: number | null;
  unit: string | null;
  note?: string | null;
}

export interface MaterialDraft {
  to?: string | null;
  cc?: string | null;
  companyName: string;
  departmentName: string;
  jobCode: string;
  jobDescription?: string | null;
  siteCode?: string | null;
  projectCode?: string | null;
  requiredBy?: string | null;
  lines: DraftLine[];
  senderName: string;
}

/** Right-pads so the plain-text table lines up in a monospaced mail client. */
function pad(s: string, width: number) {
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

export function materialRequestDraft(d: MaterialDraft): string {
  const subject =
    `Material Request — ${d.jobCode}` +
    (d.jobDescription ? ` — ${d.jobDescription}` : "");

  const header = [
    `Job:      ${d.jobCode}`,
    d.jobDescription ? `Scope:    ${d.jobDescription}` : null,
    d.projectCode ? `Project:  ${d.projectCode}` : null,
    d.siteCode ? `Site:     ${d.siteCode}` : null,
    d.requiredBy ? `Required: ${d.requiredBy}` : null,
  ].filter(Boolean) as string[];

  const w = Math.max(4, ...d.lines.map((l) => l.item.length));
  const table = [
    `${pad("Item", w)}  ${pad("Qty", 10)}  Unit`,
    `${"-".repeat(w)}  ${"-".repeat(10)}  ----`,
    ...d.lines.map(
      (l) =>
        `${pad(l.item, w)}  ${pad(l.qty == null ? "" : String(l.qty), 10)}  ${l.unit ?? ""}` +
        (l.note ? `   (${l.note})` : ""),
    ),
  ];

  const body = [
    "Dear Sir/Madam,",
    "",
    "Please quote and supply the following materials for the job below.",
    "",
    ...header,
    "",
    ...table,
    "",
    "Kindly confirm availability, unit rates and delivery date.",
    "",
    "Thank you.",
    "",
    d.senderName,
    `${d.departmentName}`,
    d.companyName,
  ].join("\n");

  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  if (d.cc) params.set("cc", d.cc);

  // encodeURIComponent leaves the spaces URLSearchParams turned into '+',
  // which mail clients render literally. Newlines must be %0A, not '+'.
  const qs = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(d.to ?? "").replace(/%40/g, "@")}?${qs}`;
}

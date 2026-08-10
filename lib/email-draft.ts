/**
 * Builds `mailto:` drafts. Nothing is sent from the app — the link opens the
 * user's own mail client with the message pre-filled, so it goes out from
 * their mailbox with their signature and stays in their sent items.
 */

export interface DraftLine {
  item: string;
  dimension?: string | null;
  grade?: string | null;
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

  // Job, scope, site, required-by and the sign-off are deliberately absent:
  // the shop asked for a bare table it can paste into its own message, and
  // the mail client already carries the sender's signature.
  const describe = (l: DraftLine) =>
    [l.item, l.dimension, l.grade].filter(Boolean).join(" ");

  const w = Math.max(4, ...d.lines.map((l) => describe(l).length));
  const qw = Math.max(3, ...d.lines.map((l) => (l.qty == null ? 0 : String(l.qty).length)));
  const table = [
    `${pad("Item", w)}  ${pad("Qty", qw)}  Unit`,
    `${"-".repeat(w)}  ${"-".repeat(qw)}  ----`,
    ...d.lines.map(
      (l) =>
        `${pad(describe(l), w)}  ${pad(l.qty == null ? "" : String(l.qty), qw)}  ${l.unit ?? ""}` +
        (l.note ? `   (${l.note})` : ""),
    ),
  ];

  const body = [
    "Dear Sir/Madam,",
    "",
    "Please quote and supply the following materials for the job below.",
    "",
    ...table,
    "",
    "Kindly confirm availability, unit rates and delivery date.",
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

export interface TransferNotice {
  to?: string | null;
  companyName: string;
  departmentName: string;
  senderName: string;
  jobDescription: string;
  qty?: number | null;
  poRef?: string | null;
  supplier?: string | null;
  siteLabel?: string | null;
  expectedCompletion?: string | null;
  remark?: string | null;
}

/**
 * Notice that a handover item is being transferred to site. Same principle as
 * the material request: it opens in the user's mail client, it is not sent.
 */
export function transferNoticeDraft(d: TransferNotice): string {
  const subject = `Transfer Notice — ${d.jobDescription}`;

  const detail = [
    `Item:      ${d.jobDescription}`,
    d.qty != null ? `Quantity:  ${d.qty}` : null,
    d.siteLabel ? `Site:      ${d.siteLabel}` : null,
    d.poRef ? `PO Ref:    ${d.poRef}` : null,
    d.supplier ? `Supplier:  ${d.supplier}` : null,
    d.expectedCompletion ? `Expected:  ${d.expectedCompletion}` : null,
  ].filter(Boolean) as string[];

  const body = [
    "Dear Sir/Madam,",
    "",
    "Please be informed that the following item is ready for transfer from the",
    "fabrication workshop to site.",
    "",
    ...detail,
    // Blank lines above and below are deliberate paragraph breaks; only the
    // remarks block is conditional.
    ...(d.remark ? ["", `Remarks:   ${d.remark}`] : []),
    "",
    "Kindly arrange to receive and acknowledge on delivery.",
    "",
    "Thank you.",
    "",
    d.senderName,
    d.departmentName,
    d.companyName,
  ].join("\n");

  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  const qs = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(d.to ?? "").replace(/%40/g, "@")}?${qs}`;
}

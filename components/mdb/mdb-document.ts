/**
 * Builds the Manufacturing Data Book as a real .docx.
 *
 * Follows the standard MDB layout the shop works to: a cover page, an index,
 * then one divider page per section carrying its tab code. Two departures
 * from the paper template, both deliberate:
 *
 *   - the index prints each section's real status instead of a bare dash, so
 *     a reader can tell "not applicable" from "not done yet";
 *   - a divider page lists the evidence attached to that section in the
 *     Documents module, which turns the divider into a contents page for the
 *     tab rather than a title card.
 *
 * Sections marked not applicable keep their index row and are not given a
 * divider page — there is nothing behind the tab to divide.
 *
 * This module is imported dynamically by the download button so `docx` never
 * loads on the server or before the user asks for the file.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

export interface MdbDocSection {
  chapter_no: string;
  chapter_title: string;
  section_no: string;
  section_title: string;
  code: string | null;
  status: string;
  doc_reference: string | null;
  notes: string | null;
  documents: { title: string; doc_type: string | null; revision: string | null }[];
}

export interface MdbDocData {
  companyName: string | null;
  companyAddress: string | null;
  documentNo: string | null;
  revision: string | null;
  projectNumber: string | null;
  projectName: string | null;
  customer: string | null;
  customerProjectNumber: string | null;
  product: string | null;
  tagNumber: string | null;
  productType: string | null;
  notes: string | null;
  jobCode: string | null;
  generatedOn: string;
  sections: MdbDocSection[];
}

const INK = "1B2430";
const MUTED = "6B7683";
const STEEL = "156082";
const RULE = "C9D1D9";

const DASH = "—";
const val = (s: string | null | undefined) => (s && s.trim() ? s.trim() : DASH);

const STATUS_LABEL: Record<string, string> = {
  included: "Included",
  pending: "Pending",
  not_applicable: "Not applicable",
};
const STATUS_COLOUR: Record<string, string> = {
  included: "1A7F43",
  pending: "9A6700",
  not_applicable: MUTED,
};

/** No borders anywhere — used for layout tables (the info blocks). */
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const HAIRLINE = {
  top: { style: BorderStyle.SINGLE, size: 1, color: RULE },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: RULE },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: RULE },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function text(
  s: string,
  opts: { size?: number; bold?: boolean; color?: string; caps?: boolean; spacing?: number } = {},
) {
  return new TextRun({
    text: s,
    size: opts.size ?? 20,
    bold: opts.bold,
    color: opts.color ?? INK,
    allCaps: opts.caps,
    characterSpacing: opts.spacing,
  });
}

function para(
  s: string,
  opts: {
    size?: number;
    bold?: boolean;
    color?: string;
    caps?: boolean;
    spacing?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
  } = {},
) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 0 },
    children: [text(s, opts)],
  });
}

/** A "Label   value" block, as used for Project / Product information. */
function infoBlock(title: string, rows: [string, string][]) {
  return [
    new Paragraph({
      spacing: { before: 280, after: 100 },
      children: [text(title, { size: 16, bold: true, color: STEEL, caps: true, spacing: 20 })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: HAIRLINE,
      rows: rows.map(
        ([k, v]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 38, type: WidthType.PERCENTAGE },
                margins: { top: 70, bottom: 70, left: 0, right: 120 },
                borders: NO_BORDERS,
                children: [para(k, { size: 18, color: MUTED })],
              }),
              new TableCell({
                width: { size: 62, type: WidthType.PERCENTAGE },
                margins: { top: 70, bottom: 70, left: 0, right: 0 },
                borders: NO_BORDERS,
                children: [para(v, { size: 18, bold: true })],
              }),
            ],
          }),
      ),
    }),
  ];
}

function projectRows(d: MdbDocData): [string, string][] {
  return [
    ["Project number", val(d.projectNumber)],
    ["Project name", val(d.projectName)],
    ["Customer", val(d.customer)],
    ["Customer project number", val(d.customerProjectNumber)],
  ];
}

function productRows(d: MdbDocData, withDoc: boolean): [string, string][] {
  const rows: [string, string][] = [
    ["Product", val(d.product)],
    ["Tag number", val(d.tagNumber)],
    ["Type", val(d.productType)],
  ];
  if (withDoc) {
    rows.push(["MDB document number", val(d.documentNo)]);
    rows.push(["Revision", val(d.revision)]);
  }
  return rows;
}

// ---------------------------------------------------------------- cover
function coverPage(d: MdbDocData): Paragraph[] | (Paragraph | Table)[] {
  const company = [
    para(val(d.companyName), { size: 22, bold: true }),
    ...(d.companyAddress ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => para(l, { size: 18, color: MUTED })),
  ];

  return [
    ...company,
    new Paragraph({
      spacing: { before: 1200, after: 0 },
      children: [text("Manufacturing", { size: 52, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [text("Data Book", { size: 52, bold: true, color: STEEL })],
    }),
    para(val(d.product), { size: 24, color: MUTED, after: 200 }),
    new Paragraph({
      spacing: { after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: STEEL } },
      children: [text("")],
    }),
    ...infoBlock("Project information", projectRows(d)),
    ...infoBlock("Product information", productRows(d, true)),
  ];
}

// ----------------------------------------------------------------- index
function indexPages(d: MdbDocData): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    para("Index", { size: 16, bold: true, color: STEEL, caps: true, spacing: 40 }),
    para("Table of Contents.", { size: 40, bold: true, after: 120 }),
    para(`${val(d.product)} MDB`, { size: 20, color: MUTED, after: 300 }),
  ];

  const chapters = new Map<string, MdbDocSection[]>();
  for (const s of d.sections) {
    const list = chapters.get(s.chapter_no);
    if (list) list.push(s);
    else chapters.set(s.chapter_no, [s]);
  }

  const rows: TableRow[] = [];
  for (const [chapterNo, sections] of Array.from(chapters.entries())) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            borders: NO_BORDERS,
            margins: { top: 160, bottom: 60, left: 0, right: 0 },
            children: [
              new Paragraph({
                children: [
                  text(`${chapterNo}  `, { size: 20, bold: true, color: STEEL }),
                  text(sections[0].chapter_title, { size: 20, bold: true, caps: true, spacing: 10 }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
    for (const s of sections) {
      const evidence = s.documents.length;
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 10, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              margins: { top: 50, bottom: 50, left: 200, right: 0 },
              children: [para(s.section_no, { size: 18, color: MUTED })],
            }),
            new TableCell({
              width: { size: 62, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              margins: { top: 50, bottom: 50, left: 0, right: 0 },
              children: [
                new Paragraph({
                  children: [
                    text(s.section_title, { size: 18 }),
                    ...(evidence > 0
                      ? [text(`   ${evidence} document${evidence === 1 ? "" : "s"}`, {
                          size: 15,
                          color: MUTED,
                        })]
                      : []),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              margins: { top: 50, bottom: 50, left: 0, right: 0 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    text(s.doc_reference?.trim() || STATUS_LABEL[s.status] || DASH, {
                      size: 16,
                      color: s.doc_reference?.trim() ? INK : STATUS_COLOUR[s.status] ?? MUTED,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
    }
  }

  out.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      rows,
    }),
  );
  return out;
}

// -------------------------------------------------------- divider pages
function dividerPage(d: MdbDocData, s: MdbDocSection): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              verticalAlign: VerticalAlign.TOP,
              children: [
                para("Chapter", { size: 15, color: MUTED, caps: true, spacing: 40 }),
                para(s.section_no, { size: 44, bold: true, color: STEEL }),
              ],
            }),
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              verticalAlign: VerticalAlign.TOP,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [text(val(d.companyName), { size: 16, color: MUTED })],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 120 },
                  children: [
                    text(s.code ?? "", { size: 26, bold: true, color: INK, spacing: 30 }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 700, after: 120 },
      children: [
        text(`${s.chapter_no}  ${s.chapter_title}`, {
          size: 18,
          bold: true,
          color: STEEL,
          caps: true,
          spacing: 20,
        }),
      ],
    }),
    para(`${s.section_title}.`, { size: 38, bold: true, after: 160 }),
    new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: STEEL } },
      children: [text("")],
    }),
  ];

  if (s.doc_reference?.trim()) {
    out.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          text("Reference   ", { size: 16, color: MUTED, caps: true }),
          text(s.doc_reference.trim(), { size: 18, bold: true }),
        ],
      }),
    );
  }
  if (s.notes?.trim()) {
    out.push(para(s.notes.trim(), { size: 18, color: MUTED, after: 120 }));
  }

  // The evidence register for this tab.
  if (s.documents.length > 0) {
    out.push(
      new Paragraph({
        spacing: { before: 260, after: 100 },
        children: [
          text("Documents in this section", {
            size: 16,
            bold: true,
            color: STEEL,
            caps: true,
            spacing: 20,
          }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: HAIRLINE,
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["#", "Document", "Type", "Rev"].map(
              (h, i) =>
                new TableCell({
                  width: {
                    size: [8, 60, 22, 10][i],
                    type: WidthType.PERCENTAGE,
                  },
                  borders: NO_BORDERS,
                  margins: { top: 70, bottom: 70, left: 0, right: 80 },
                  children: [para(h, { size: 15, color: MUTED, caps: true, spacing: 20 })],
                }),
            ),
          }),
          ...s.documents.map(
            (doc, i) =>
              new TableRow({
                children: [
                  new TableCell({
                    borders: NO_BORDERS,
                    margins: { top: 70, bottom: 70, left: 0, right: 80 },
                    children: [para(String(i + 1), { size: 17, color: MUTED })],
                  }),
                  new TableCell({
                    borders: NO_BORDERS,
                    margins: { top: 70, bottom: 70, left: 0, right: 80 },
                    children: [para(doc.title, { size: 17 })],
                  }),
                  new TableCell({
                    borders: NO_BORDERS,
                    margins: { top: 70, bottom: 70, left: 0, right: 80 },
                    children: [
                      para((doc.doc_type ?? DASH).replace(/_/g, " "), { size: 17, color: MUTED }),
                    ],
                  }),
                  new TableCell({
                    borders: NO_BORDERS,
                    margins: { top: 70, bottom: 70, left: 0, right: 0 },
                    children: [para(val(doc.revision), { size: 17, color: MUTED })],
                  }),
                ],
              }),
          ),
        ],
      }),
    );
  } else {
    out.push(
      para("Insert the documents for this section behind this divider.", {
        size: 17,
        color: MUTED,
        before: 200,
      }),
    );
  }

  out.push(...infoBlock("Project information", projectRows(d)));
  out.push(...infoBlock("Product information", productRows(d, false)));
  return out;
}

/** Build the .docx and return it as a Blob ready to download. */
export async function buildMdbDocx(d: MdbDocData): Promise<Blob> {
  const printable = d.sections.filter((s) => s.status !== "not_applicable");

  const body: (Paragraph | Table)[] = [...coverPage(d)];

  body.push(new Paragraph({ children: [new PageBreak()] }));
  body.push(...indexPages(d));

  for (const s of printable) {
    body.push(new Paragraph({ children: [new PageBreak()] }));
    body.push(...dividerPage(d, s));
  }

  if (d.notes?.trim()) {
    body.push(new Paragraph({ children: [new PageBreak()] }));
    body.push(para("Notes.", { size: 38, bold: true, after: 200 }));
    for (const line of d.notes.split("\n")) {
      body.push(para(line.trim() || " ", { size: 18, after: 60 }));
    }
  }

  const doc = new Document({
    creator: d.companyName ?? "Fabrication Job Book",
    title: `Manufacturing Data Book — ${d.product ?? d.jobCode ?? ""}`,
    description: `MDB ${d.documentNo ?? ""} rev ${d.revision ?? ""}`,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20, color: INK } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                spacing: { after: 200 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: RULE } },
                children: [
                  text("Manufacturing Data Book", { size: 15, color: MUTED }),
                  text(
                    `${d.projectNumber ? `     ${d.projectNumber}` : ""}${
                      d.product ? `  |  ${d.product}` : ""
                    }`,
                    { size: 15, color: MUTED },
                  ),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  text(
                    `${d.documentNo ?? ""}${d.revision ? ` · Rev ${d.revision}` : ""} · ${d.generatedOn}     `,
                    { size: 15, color: MUTED },
                  ),
                  new TextRun({ children: [PageNumber.CURRENT], size: 15, color: MUTED }),
                  text(" / ", { size: 15, color: MUTED }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: MUTED }),
                ],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });

  return Packer.toBlob(doc);
}

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { MdbDocData, MdbDocSection } from "./mdb-document";

/**
 * The MDB front matter as PDF: cover, index, and one divider page per
 * printable section — the same book the Word export produces, in the format
 * that can actually carry the certificates behind each divider.
 *
 * This is only half of the complete book. mdb-assemble.ts renders this, then
 * splices each section's real documents in after its divider page, which is
 * why every divider is emitted as its own single page: the assembler needs to
 * know exactly where one ends.
 */

const TEAL = "#156082";
const NAVY = "#0E2841";
const MUTED = "#5A6B7B";
const RULE = "#C9D1D9";
const GREEN = "#1A7F43";
const AMBER = "#9A6700";

const DASH = "—";
const val = (s: string | null | undefined) => (s && s.trim() ? s.trim() : DASH);

const STATUS_LABEL: Record<string, string> = {
  included: "Included",
  pending: "Pending",
  not_applicable: "Not applicable",
};
const STATUS_COLOUR: Record<string, string> = {
  included: GREEN,
  pending: AMBER,
  not_applicable: MUTED,
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: NAVY },

  company: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  companyLine: { fontSize: 8, color: MUTED },

  coverTitle: { fontSize: 30, fontFamily: "Helvetica-Bold", marginTop: 90 },
  coverTitleAccent: { fontSize: 30, fontFamily: "Helvetica-Bold", color: TEAL },
  coverProduct: { fontSize: 12, color: MUTED, marginTop: 10 },
  rule: { borderBottomWidth: 2, borderBottomColor: TEAL, marginTop: 12, marginBottom: 16 },

  blockTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 5,
  },
  infoRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 3.5,
  },
  infoKey: { width: "38%", color: MUTED },
  infoVal: { width: "62%", fontFamily: "Helvetica-Bold" },

  eyebrow: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 4 },
  sub: { fontSize: 10, color: MUTED, marginTop: 4, marginBottom: 12 },

  chapterRow: { flexDirection: "row", marginTop: 12, marginBottom: 3 },
  chapterNo: { fontFamily: "Helvetica-Bold", color: TEAL, width: 22 },
  chapterTitle: {
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 9,
  },
  idxRow: { flexDirection: "row", paddingVertical: 2.5, paddingLeft: 22 },
  idxNo: { width: 34, color: MUTED, fontSize: 8.5 },
  idxTitle: { flex: 1, fontSize: 8.5 },
  idxEvidence: { color: MUTED, fontSize: 7.5 },
  idxRight: { width: 120, textAlign: "right", fontSize: 8 },

  dividerHead: { flexDirection: "row", justifyContent: "space-between" },
  dividerChapterLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 1 },
  dividerNo: { fontSize: 26, fontFamily: "Helvetica-Bold", color: TEAL, marginTop: 2 },
  dividerCode: { fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, marginTop: 6 },
  dividerChapter: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 60,
  },
  dividerTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 6 },

  tblHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 3,
    marginTop: 4,
  },
  tblRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 3.5,
  },
  th: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },

  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: MUTED,
  },
});

function Info({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <View>
      <Text style={s.blockTitle}>{title}</Text>
      {rows.map(([k, v]) => (
        <View key={k} style={s.infoRow}>
          <Text style={s.infoKey}>{k}</Text>
          <Text style={s.infoVal}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

const projectRows = (d: MdbDocData): [string, string][] => [
  ["Project number", val(d.projectNumber)],
  ["Project name", val(d.projectName)],
  ["Customer", val(d.customer)],
  ["Customer project number", val(d.customerProjectNumber)],
];

const productRows = (d: MdbDocData, withDoc: boolean): [string, string][] => [
  ["Product", val(d.product)],
  ["Tag number", val(d.tagNumber)],
  ["Type", val(d.productType)],
  ...(withDoc
    ? ([
        ["MDB document number", val(d.documentNo)],
        ["Revision", val(d.revision)],
      ] as [string, string][])
    : []),
];

function Footer({ d }: { d: MdbDocData }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {val(d.documentNo)}
        {d.revision ? ` · Rev ${d.revision}` : ""}
      </Text>
      <Text>{d.generatedOn}</Text>
    </View>
  );
}

/**
 * `mode` exists for the assembler. It renders the front matter once and then
 * each divider as its own document, so a divider that overflows onto a second
 * page still lines up with its own documents — splicing by a fixed page
 * offset would silently misfile everything after the first long section.
 */
export function MdbPdfDocument({
  data,
  mode = "full",
  section,
}: {
  data: MdbDocData;
  mode?: "full" | "front" | "divider";
  section?: MdbDocSection;
}) {
  const d = data;
  const printable =
    mode === "divider"
      ? section
        ? [section]
        : []
      : mode === "front"
        ? []
        : d.sections.filter((x) => x.status !== "not_applicable");
  const showFront = mode !== "divider";

  const chapters: [string, MdbDocSection[]][] = [];
  for (const sec of d.sections) {
    const last = chapters[chapters.length - 1];
    if (last && last[0] === sec.chapter_no) last[1].push(sec);
    else chapters.push([sec.chapter_no, [sec]]);
  }

  return (
    <Document
      title={`Manufacturing Data Book — ${d.product ?? d.jobCode ?? ""}`}
      author={d.companyName ?? undefined}
    >
      {/* Cover */}
      {showFront && (
      <Page size="A4" style={s.page}>
        <Text style={s.company}>{val(d.companyName)}</Text>
        {(d.companyAddress ?? "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l, i) => (
            <Text key={i} style={s.companyLine}>
              {l}
            </Text>
          ))}

        <Text style={s.coverTitle}>Manufacturing</Text>
        <Text style={s.coverTitleAccent}>Data Book</Text>
        <Text style={s.coverProduct}>{val(d.product)}</Text>
        <View style={s.rule} />

        <Info title="Project information" rows={projectRows(d)} />
        <Info title="Product information" rows={productRows(d, true)} />
        <Footer d={d} />
      </Page>
      )}

      {/* Index */}
      {showFront && (
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>Index</Text>
        <Text style={s.h1}>Table of Contents.</Text>
        <Text style={s.sub}>{val(d.product)} MDB</Text>

        {chapters.map(([no, rows]) => (
          <View key={no} wrap={false}>
            <View style={s.chapterRow}>
              <Text style={s.chapterNo}>{no}</Text>
              <Text style={s.chapterTitle}>{rows[0].chapter_title}</Text>
            </View>
            {rows.map((sec) => (
              <View key={sec.section_no} style={s.idxRow}>
                <Text style={s.idxNo}>{sec.section_no}</Text>
                <Text style={s.idxTitle}>
                  {sec.section_title}
                  {sec.documents.length > 0 && (
                    <Text style={s.idxEvidence}>
                      {"   "}
                      {sec.documents.length} document
                      {sec.documents.length === 1 ? "" : "s"}
                    </Text>
                  )}
                </Text>
                <Text
                  style={[
                    s.idxRight,
                    {
                      color: sec.doc_reference?.trim()
                        ? NAVY
                        : STATUS_COLOUR[sec.status] ?? MUTED,
                    },
                  ]}
                >
                  {sec.doc_reference?.trim() || STATUS_LABEL[sec.status] || DASH}
                </Text>
              </View>
            ))}
          </View>
        ))}
        <Footer d={d} />
      </Page>
      )}

      {/* One divider page per printable section. Kept to exactly one page so
          the assembler can splice the section's documents in behind it. */}
      {printable.map((sec) => (
        <Page key={sec.section_no} size="A4" style={s.page}>
          <View style={s.dividerHead}>
            <View>
              <Text style={s.dividerChapterLabel}>Chapter</Text>
              <Text style={s.dividerNo}>{sec.section_no}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 8, color: MUTED, textAlign: "right" }}>
                {val(d.companyName)}
              </Text>
              <Text style={[s.dividerCode, { textAlign: "right" }]}>{sec.code ?? ""}</Text>
            </View>
          </View>

          <Text style={s.dividerChapter}>
            {sec.chapter_no}  {sec.chapter_title}
          </Text>
          <Text style={s.dividerTitle}>{sec.section_title}.</Text>
          <View style={s.rule} />

          {!!sec.doc_reference?.trim() && (
            <Text style={{ marginBottom: 4 }}>
              <Text style={{ color: MUTED, textTransform: "uppercase", fontSize: 7.5 }}>
                Reference{"   "}
              </Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{sec.doc_reference.trim()}</Text>
            </Text>
          )}
          {!!sec.notes?.trim() && (
            <Text style={{ color: MUTED, marginBottom: 6 }}>{sec.notes.trim()}</Text>
          )}

          {sec.documents.length > 0 ? (
            <View>
              <Text style={s.blockTitle}>Documents in this section</Text>
              <View style={s.tblHead}>
                <Text style={[s.th, { width: 24 }]}>#</Text>
                <Text style={[s.th, { flex: 1 }]}>Document</Text>
                <Text style={[s.th, { width: 110 }]}>Type</Text>
                <Text style={[s.th, { width: 40 }]}>Rev</Text>
              </View>
              {sec.documents.map((doc, i) => (
                <View key={i} style={s.tblRow}>
                  <Text style={{ width: 24, color: MUTED }}>{i + 1}</Text>
                  <Text style={{ flex: 1 }}>{doc.title}</Text>
                  <Text style={{ width: 110, color: MUTED }}>
                    {(doc.doc_type ?? DASH).replace(/_/g, " ")}
                  </Text>
                  <Text style={{ width: 40, color: MUTED }}>{val(doc.revision)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: MUTED, marginTop: 10 }}>
              No documents attached to this section.
            </Text>
          )}

          <Info title="Project information" rows={projectRows(d)} />
          <Info title="Product information" rows={productRows(d, false)} />
          <Footer d={d} />
        </Page>
      ))}
    </Document>
  );
}

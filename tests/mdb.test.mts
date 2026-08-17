/**
 * MDB template and Word export.
 *
 * The export is the deliverable a client receives, so the shape of the book
 * is worth pinning: a valid .docx, the right pages, and — the rule that is
 * easiest to break silently — not-applicable sections appearing in the index
 * but never getting a divider page.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  MDB_CHAPTERS,
  MDB_STATUSES,
  MDB_STRUCTURAL_PRESET,
  MDB_TEMPLATE,
  mdbStatusMeta,
} from "../lib/mdb/template.ts";
import { buildMdbDocx, type MdbDocData } from "../components/mdb/mdb-document.ts";

test("the catalogue is the full 12-chapter book", () => {
  assert.equal(MDB_TEMPLATE.length, 52);
  assert.equal(Object.keys(MDB_CHAPTERS).length, 12);

  const numbers = new Set(MDB_TEMPLATE.map((s) => s.section_no));
  assert.equal(numbers.size, 52, "section numbers must be unique");

  for (const s of MDB_TEMPLATE) {
    assert.ok(MDB_CHAPTERS[s.chapter_no], `${s.section_no} references a real chapter`);
    assert.ok(
      s.section_no.startsWith(`${s.chapter_no}.`),
      `${s.section_no} must sit under chapter ${s.chapter_no}`,
    );
    assert.ok(s.code.length > 0 && s.section_title.length > 0);
  }
});

test("the structural preset only names sections that exist", () => {
  for (const no of MDB_STRUCTURAL_PRESET) {
    assert.ok(
      MDB_TEMPLATE.some((s) => s.section_no === no),
      `preset references unknown section ${no}`,
    );
  }
  assert.ok(MDB_STRUCTURAL_PRESET.size > 0 && MDB_STRUCTURAL_PRESET.size < 52);
});

test("status metadata falls back to pending", () => {
  assert.equal(mdbStatusMeta("included").label, "Included");
  assert.equal(mdbStatusMeta(null).value, "pending");
  assert.equal(mdbStatusMeta("nonsense").value, "pending");
  // The database check constraint allows exactly these three.
  assert.deepEqual(MDB_STATUSES.map((s) => s.value).sort(), [
    "included",
    "not_applicable",
    "pending",
  ]);
});

function sampleData(overrides: Partial<MdbDocData> = {}): MdbDocData {
  return {
    companyName: "Six Construct",
    companyAddress: "Dubai Investments Park",
    documentNo: "BAF-INP-AP4-AUG-001-MDB",
    revision: "A",
    projectNumber: "PRJ-2026-002",
    projectName: "Pipe Rack Steelwork",
    customer: "RTA Dubai",
    customerProjectNumber: "RTA-118",
    product: "Pipe Rack Modules",
    tagNumber: "PR-01/06",
    productType: "Structural steel assembly",
    notes: null,
    jobCode: "BAF-INP-AP4-AUG-001",
    generatedOn: "2026-08-17",
    sections: [
      {
        chapter_no: "1",
        chapter_title: MDB_CHAPTERS["1"],
        section_no: "1.1",
        section_title: "Inspection & Test Plan",
        code: "ITP",
        status: "included",
        doc_reference: "ITP-001 Rev B",
        notes: null,
        documents: [{ title: "ITP signed", doc_type: "inspection_report", revision: "B" }],
      },
      {
        chapter_no: "6",
        chapter_title: MDB_CHAPTERS["6"],
        section_no: "6.3",
        section_title: "Radiographic Testing",
        code: "RT",
        status: "not_applicable",
        doc_reference: null,
        notes: null,
        documents: [],
      },
    ],
    ...overrides,
  };
}

/** The .docx is a zip; pull word/document.xml out of it without a library. */
async function documentXml(blob: Blob): Promise<{ xml: string; entries: string[] }> {
  const buf = Buffer.from(await blob.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK", "must be a zip archive");

  const { promisify } = await import("node:util");
  const { inflateRaw } = await import("node:zlib");
  const inflate = promisify(inflateRaw);

  const entries: string[] = [];
  let xml = "";
  // Walk the local file headers.
  for (let i = 0; i < buf.length - 4; i++) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue;
    const method = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString();
    entries.push(name);
    if (name === "word/document.xml" && compSize > 0) {
      const start = i + 30 + nameLen + extraLen;
      const raw = buf.subarray(start, start + compSize);
      xml = (method === 8 ? await inflate(raw) : raw).toString("utf8");
    }
  }
  return { xml, entries };
}

test("the export is a valid docx carrying the book", async () => {
  const blob = await buildMdbDocx(sampleData());
  const { xml, entries } = await documentXml(blob);

  for (const part of ["[Content_Types].xml", "word/document.xml", "_rels/.rels"]) {
    assert.ok(entries.includes(part), `missing ${part}`);
  }
  assert.ok(xml.length > 0, "word/document.xml must be readable");
  // Ampersands in section titles must be escaped, or Word rejects the file.
  assert.ok(xml.includes("Inspection &amp; Test Plan"));
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(xml), "unescaped ampersand in document.xml");
  assert.ok(xml.includes("PRJ-2026-002") && xml.includes("RTA Dubai"));
});

test("a not-applicable section is indexed but gets no divider page", async () => {
  const { xml } = await documentXml(await buildMdbDocx(sampleData()));
  const strip = (s: string) => s.replace(/<[^>]+>/g, "");
  const text = strip(xml);

  const rt = text.split("Radiographic Testing").length - 1;
  const itp = text.split("Inspection &amp; Test Plan").length - 1;
  assert.equal(rt, 1, "not-applicable section belongs in the index only");
  assert.equal(itp, 2, "an included section appears in the index and on its divider");

  // Cover -> index is one break; the single printable section adds one more.
  assert.equal(xml.split('w:type="page"').length - 1, 2);
});

test("every section not-applicable still produces a readable book", async () => {
  const data = sampleData();
  data.sections = data.sections.map((s) => ({ ...s, status: "not_applicable" }));
  const { xml } = await documentXml(await buildMdbDocx(data));
  assert.ok(xml.includes("Table of Contents"), "the index must survive an empty book");
  assert.equal(xml.split('w:type="page"').length - 1, 1, "cover -> index break only");
});

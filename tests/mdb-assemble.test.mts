/**
 * Complete-book PDF assembly.
 *
 * The rule that matters and is easiest to break silently: each section's
 * documents must land behind *its own* divider. If the splice drifts by a
 * page, a client receives mill certificates filed under the wrong chapter and
 * nothing in the file says so.
 *
 * The front matter is rendered by @react-pdf/renderer, which Node cannot
 * compile here (type stripping does not handle JSX). tests/stubs swaps it for
 * a renderer that emits the same page counts, so this exercises the fetching,
 * type detection, merge order, skip handling and page maths — the parts that
 * can be wrong without anyone noticing. The visual layout is checked by eye.
 *
 * Run via `npm test`, which registers tests/stubs/loader.mjs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { assembleMdbPdf, type AssembleInput } from "../components/mdb/mdb-assemble.ts";

/** A real PDF of `pages` pages, each stamped so it can be identified later. */
async function makePdf(pages: number): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([595.28, 841.89]);
  return d.save();
}

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Serves fake storage over the fetch the assembler uses. */
function installFetch(files: Record<string, Uint8Array | Buffer | "404">) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    const key = String(url).replace("test://", "");
    const body = files[key];
    if (!body || body === "404") return { ok: false, status: 404 } as Response;
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    } as Response;
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const signedUrl = async (p: string) => ({ url: `test://${p}`, error: null });

function section(
  no: string,
  title: string,
  status: string,
  docs: {
    id: string;
    title: string;
    file_path: string;
    mime_type: string | null;
  }[],
) {
  return {
    chapter_no: no.split(".")[0],
    chapter_title: "Chapter",
    section_no: no,
    section_title: title,
    code: "X",
    status,
    doc_reference: null,
    notes: null,
    documents: docs.map((d) => ({ title: d.title, doc_type: null, revision: null })),
    sourceDocuments: docs.map((d) => ({ ...d, doc_type: null, revision: null })),
  };
}

function input(sections: ReturnType<typeof section>[]): AssembleInput {
  return {
    companyName: "Six Construct",
    companyAddress: null,
    documentNo: "MDB-1",
    revision: "A",
    projectNumber: "PRJ-2026-002",
    projectName: "Pipe Rack",
    customer: "RTA",
    customerProjectNumber: null,
    product: "Pipe Rack Modules",
    tagNumber: null,
    productType: null,
    notes: null,
    jobCode: "BAF-INP-AP4-AUG-001",
    generatedOn: "2026-08-17",
    sections,
  };
}

test("documents are merged behind their own divider, in order", async () => {
  const cert = await makePdf(3);
  const wps = await makePdf(2);
  const restore = installFetch({ "a/cert.pdf": cert, "a/wps.pdf": wps });
  try {
    const data = input([
      section("3.2", "Material Certificates", "included", [
        { id: "1", title: "Mill cert", file_path: "a/cert.pdf", mime_type: "application/pdf" },
      ]),
      section("4.2", "WPS", "included", [
        { id: "2", title: "WPS 001", file_path: "a/wps.pdf", mime_type: "application/pdf" },
      ]),
    ]);
    const res = await assembleMdbPdf(data, signedUrl);

    // front(2) + divider(1)+cert(3) + divider(1)+wps(2)
    assert.equal(res.pageCount, 9);
    assert.equal(res.merged, 2);
    assert.deepEqual(res.skipped, []);

    const out = await PDFDocument.load(await res.blob.arrayBuffer());
    assert.equal(out.getPageCount(), 9, "the merged file must reload cleanly");
  } finally {
    restore();
  }
});

test("a not-applicable section contributes nothing; pending still gets a divider", async () => {
  const restore = installFetch({});
  try {
    const res = await assembleMdbPdf(
      input([
        section("6.3", "Radiographic Testing", "not_applicable", []),
        section("9.2", "Paint Reports", "pending", []),
      ]),
      signedUrl,
    );
    // front(2) + pending divider(1); the not-applicable section adds nothing.
    assert.equal(res.pageCount, 3);
    assert.equal(res.merged, 0);
  } finally {
    restore();
  }
});

test("images become a page; unmergeable and unreadable files are reported", async () => {
  const restore = installFetch({
    "a/photo.png": PNG_1x1,
    "a/broken.pdf": Buffer.from("%PDF-1.4 not actually a pdf"),
    "a/spec.docx": Buffer.from("PK not a pdf either"),
    "a/missing.pdf": "404",
  });
  try {
    const res = await assembleMdbPdf(
      input([
        section("7.1", "Dimensional Reports", "included", [
          { id: "1", title: "Weld photo", file_path: "a/photo.png", mime_type: "image/png" },
          { id: "2", title: "Corrupt scan", file_path: "a/broken.pdf", mime_type: "application/pdf" },
          {
            id: "3",
            title: "Spec (Word)",
            file_path: "a/spec.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
          { id: "4", title: "Gone", file_path: "a/missing.pdf", mime_type: "application/pdf" },
        ]),
      ]),
      signedUrl,
    );

    // front(2) + divider(1) + the image(1). The other three are skipped.
    assert.equal(res.pageCount, 4);
    assert.equal(res.merged, 1, "only the image merged");
    assert.equal(res.skipped.length, 3);

    const titles = res.skipped.map((s) => s.title).sort();
    assert.deepEqual(titles, ["Corrupt scan", "Gone", "Spec (Word)"]);
    // Every skip must name the section it belonged to, or it cannot be fixed.
    for (const sk of res.skipped) {
      assert.match(sk.section, /^7\.1 /);
      assert.ok(sk.reason.length > 0);
    }
    const wordSkip = res.skipped.find((s) => s.title === "Spec (Word)");
    assert.match(wordSkip!.reason, /cannot be merged/);
  } finally {
    restore();
  }
});

test("a file type is recognised by extension when the mime type is missing", async () => {
  const restore = installFetch({ "a/cert.pdf": await makePdf(1) });
  try {
    const res = await assembleMdbPdf(
      input([
        section("3.2", "Material Certificates", "included", [
          { id: "1", title: "Mill cert", file_path: "a/cert.pdf", mime_type: null },
        ]),
      ]),
      signedUrl,
    );
    assert.equal(res.merged, 1, "extension must be enough when mime_type is null");
    assert.equal(res.pageCount, 4); // front(2) + divider(1) + cert(1)
  } finally {
    restore();
  }
});

test("progress is reported once per printable section, plus the front matter", async () => {
  const restore = installFetch({});
  try {
    const seen: string[] = [];
    await assembleMdbPdf(
      input([
        section("1.1", "ITP", "included", []),
        section("6.3", "RT", "not_applicable", []),
        section("9.2", "Paint", "pending", []),
      ]),
      signedUrl,
      (done, total, label) => seen.push(`${done}/${total} ${label}`),
    );
    // 2 printable sections + the front matter.
    assert.equal(seen.length, 3);
    assert.match(seen[0], /^1\/3 Cover and index$/);
    assert.match(seen[2], /^3\/3 9\.2 Paint$/);
  } finally {
    restore();
  }
});

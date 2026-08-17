/**
 * Assembles the complete Manufacturing Data Book as one PDF: the cover and
 * index, then each section's divider followed by the actual certificates and
 * reports attached to it.
 *
 * Why PDF and not Word: Word cannot flow a PDF's pages inline. Embedding one
 * gives an icon the reader has to double-click, which is not a data book. PDF
 * is what a client is issued anyway.
 *
 * The front matter is rendered by @react-pdf/renderer (the same engine as the
 * app's other exports) and merged with the source files by pdf-lib. Each
 * divider is rendered as its own document rather than sliced out of one long
 * render, so a divider that runs onto a second page still keeps its own
 * documents behind it.
 *
 * Anything that is not a PDF or a JPEG/PNG cannot be merged — a .docx or
 * .xlsx has no page geometry to copy. Those are reported back as skipped, so
 * the user is told plainly rather than quietly handed an incomplete book.
 */
import type { MdbDocData, MdbDocSection } from "./mdb-document";

export interface AssembleSourceDoc {
  id: string;
  title: string;
  doc_type: string | null;
  revision: string | null;
  file_path: string;
  mime_type: string | null;
}

/** Sections in book order, each with the files to place behind its divider. */
export interface AssembleSection extends MdbDocSection {
  sourceDocuments: AssembleSourceDoc[];
}

export interface AssembleInput extends MdbDocData {
  sections: AssembleSection[];
}

export interface AssembleSkip {
  title: string;
  section: string;
  reason: string;
}

export interface AssembleResult {
  blob: Blob;
  pageCount: number;
  merged: number;
  skipped: AssembleSkip[];
}

type Progress = (done: number, total: number, label: string) => void;

const isPdf = (mime: string | null, path: string) =>
  (mime ?? "").includes("pdf") || /\.pdf$/i.test(path);
const isJpeg = (mime: string | null, path: string) =>
  (mime ?? "").includes("jpeg") || /\.jpe?g$/i.test(path);
const isPng = (mime: string | null, path: string) =>
  (mime ?? "").includes("png") || /\.png$/i.test(path);

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 28;

export async function assembleMdbPdf(
  data: AssembleInput,
  /** Resolves a storage path to a short-lived signed URL. */
  signedUrlFor: (filePath: string) => Promise<{ url: string | null; error: string | null }>,
  onProgress?: Progress,
): Promise<AssembleResult> {
  const [{ pdf }, { MdbPdfDocument }, { PDFDocument }, React] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./mdb-pdf-document"),
    import("pdf-lib"),
    import("react"),
  ]);

  const printable = data.sections.filter((s) => s.status !== "not_applicable");
  const total = printable.length + 1;
  let done = 0;
  const step = (label: string) => onProgress?.(++done, total, label);

  const out = await PDFDocument.create();
  out.setTitle(`Manufacturing Data Book — ${data.product ?? data.jobCode ?? ""}`);
  if (data.companyName) out.setAuthor(data.companyName);
  if (data.documentNo) out.setSubject(`${data.documentNo} Rev ${data.revision ?? ""}`.trim());

  const skipped: AssembleSkip[] = [];
  let merged = 0;

  /** Render a react-pdf document and copy every page into the output. */
  async function appendRendered(element: React.ReactElement) {
    const blob = await pdf(element as never).toBlob();
    const src = await PDFDocument.load(await blob.arrayBuffer());
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }

  // Cover + index.
  await appendRendered(
    React.createElement(MdbPdfDocument, { data, mode: "front" }) as React.ReactElement,
  );
  step("Cover and index");

  for (const section of printable) {
    // The divider for this tab.
    await appendRendered(
      React.createElement(MdbPdfDocument, {
        data,
        mode: "divider",
        section,
      }) as React.ReactElement,
    );

    // Then its evidence, in the order it is listed on the divider.
    for (const doc of section.sourceDocuments) {
      const where = `${section.section_no} ${section.section_title}`;
      try {
        const signed = await signedUrlFor(doc.file_path);
        if (!signed.url) {
          skipped.push({
            title: doc.title,
            section: where,
            reason: signed.error ?? "could not be opened",
          });
          continue;
        }
        const res = await fetch(signed.url);
        if (!res.ok) {
          skipped.push({ title: doc.title, section: where, reason: `download failed (${res.status})` });
          continue;
        }
        const bytes = new Uint8Array(await res.arrayBuffer());

        if (isPdf(doc.mime_type, doc.file_path)) {
          // ignoreEncryption: many mill certs arrive print-protected. The
          // pages are still readable; refusing them would drop real evidence.
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((p) => out.addPage(p));
          merged++;
        } else if (isJpeg(doc.mime_type, doc.file_path) || isPng(doc.mime_type, doc.file_path)) {
          const img = isPng(doc.mime_type, doc.file_path)
            ? await out.embedPng(bytes)
            : await out.embedJpg(bytes);
          const page = out.addPage([A4.width, A4.height]);
          const maxW = A4.width - MARGIN * 2;
          const maxH = A4.height - MARGIN * 2;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, {
            x: (A4.width - w) / 2,
            y: (A4.height - h) / 2,
            width: w,
            height: h,
          });
          merged++;
        } else {
          skipped.push({
            title: doc.title,
            section: where,
            reason: `${doc.mime_type ?? "this file type"} cannot be merged into a PDF`,
          });
        }
      } catch (err) {
        skipped.push({
          title: doc.title,
          section: where,
          reason: err instanceof Error ? err.message : "unreadable file",
        });
      }
    }
    step(`${section.section_no} ${section.section_title}`);
  }

  const bytes = await out.save();
  // Copy into a fresh ArrayBuffer so the Blob never holds a SharedArrayBuffer.
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);

  return {
    blob: new Blob([buf], { type: "application/pdf" }),
    pageCount: out.getPageCount(),
    merged,
    skipped,
  };
}

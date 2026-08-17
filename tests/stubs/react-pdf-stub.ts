/**
 * Stands in for @react-pdf/renderer during tests. Node cannot compile the
 * .tsx front-matter component (type stripping does not do JSX), and the
 * layout is a visual concern anyway. What matters here is the page maths, so
 * the stub emits a real PDF with the same page count the component would.
 */
import { PDFDocument } from "pdf-lib";

export const pdf = (element: { props: { mode?: string; section?: unknown } }) => ({
  async toBlob() {
    const mode = element?.props?.mode ?? "full";
    // Cover + index = 2 pages; a divider = 1 page.
    const pages = mode === "front" ? 2 : 1;
    const d = await PDFDocument.create();
    for (let i = 0; i < pages; i++) d.addPage([595.28, 841.89]);
    const bytes = await d.save();
    const buf = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buf).set(bytes);
    return new Blob([buf], { type: "application/pdf" });
  },
});

import { jsPDF, GState } from "jspdf";
import { loadImage } from "./imageProcessing";
import { printDataUrl } from "./idPrint";

export async function exportDocumentPdf(
  title: string,
  pageDataUrls: string[],
  options?: { watermark?: string; a4?: boolean },
): Promise<Blob> {
  if (pageDataUrls.length === 0) {
    throw new Error("No pages to export");
  }

  let pdf: jsPDF | null = null;
  const watermark = options?.watermark?.trim();

  for (const src of pageDataUrls) {
    const img = await loadImage(src);
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    if (options?.a4) {
      const orientation = w >= h ? "l" : "p";
      if (!pdf) {
        pdf = new jsPDF({
          orientation,
          unit: "mm",
          format: "a4",
          compress: true,
        });
      } else {
        pdf.addPage("a4", orientation);
      }
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgRatio = w / h;
      const pageRatio = pageW / pageH;
      let drawW = pageW;
      let drawH = pageH;
      if (imgRatio > pageRatio) {
        drawH = pageW / imgRatio;
      } else {
        drawW = pageH * imgRatio;
      }
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;
      pdf.addImage(src, "JPEG", x, y, drawW, drawH, undefined, "FAST");
      if (watermark) {
        pdf.setGState(new GState({ opacity: 0.15 }));
        pdf.setTextColor(15, 118, 110);
        pdf.setFontSize(28);
        pdf.text(watermark, pageW / 2, pageH / 2, {
          align: "center",
          angle: 35,
        });
        pdf.setGState(new GState({ opacity: 1 }));
      }
    } else {
      const orientation = w >= h ? "l" : "p";
      if (!pdf) {
        pdf = new jsPDF({
          orientation,
          unit: "pt",
          format: [w, h],
          compress: true,
        });
      } else {
        pdf.addPage([w, h], orientation);
      }
      pdf.addImage(src, "JPEG", 0, 0, w, h, undefined, "FAST");
      if (watermark) {
        pdf.setGState(new GState({ opacity: 0.14 }));
        pdf.setTextColor(15, 118, 110);
        pdf.setFontSize(Math.max(24, Math.round(w / 18)));
        pdf.text(watermark, w / 2, h / 2, { align: "center", angle: 35 });
        pdf.setGState(new GState({ opacity: 1 }));
      }
    }
  }

  if (!pdf) throw new Error("Failed to create PDF");
  pdf.setProperties({ title });
  return pdf.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function printDocumentPages(
  pageDataUrls: string[],
  title = "Document",
) {
  if (!pageDataUrls.length) return;
  const parts = pageDataUrls
    .map(
      (src) =>
        `<div class="page"><img src="${src}" /></div>`,
    )
    .join("");
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
  if (!w) throw new Error("Pop-up blocked — allow pop-ups to print");
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      @page { margin: 10mm; }
      body { margin: 0; font-family: sans-serif; }
      .page { page-break-after: always; text-align: center; }
      .page:last-child { page-break-after: auto; }
      img { max-width: 100%; max-height: 260mm; object-fit: contain; }
    </style></head><body>${parts}
    <script>window.onload=()=>setTimeout(()=>{window.focus();window.print()},250)</script>
    </body></html>`);
  w.document.close();
}

/** Single-page print helper used by ID sheets too. */
export { printDataUrl };

import { jsPDF, GState } from "jspdf";
import { loadImage } from "./imageProcessing";
import { printDataUrl } from "./idPrint";

/**
 * Normalize any image data-URL (PNG/WebP/JPEG) to a JPEG data-URL.
 * jsPDF often renders blank pages when format doesn't match the bytes
 * (e.g. PNG passed as "JPEG") or when images are extremely large.
 */
async function toPdfJpeg(
  src: string,
  maxSide = 2400,
): Promise<{ dataUrl: string; w: number; h: number }> {
  const img = await loadImage(src);
  let w = img.naturalWidth || 1;
  let h = img.naturalHeight || 1;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  // White background so transparent PNGs don't become black/empty
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
    w,
    h,
  };
}

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
    if (!src) continue;
    const { dataUrl, w, h } = await toPdfJpeg(src);

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
      pdf.addImage(dataUrl, "JPEG", x, y, drawW, drawH, undefined, "FAST");
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
      // Cap page size in points for PDF viewers / jsPDF stability
      const maxPt = 2000;
      const ptScale = Math.min(1, maxPt / Math.max(w, h));
      const pw = Math.max(1, Math.round(w * ptScale));
      const ph = Math.max(1, Math.round(h * ptScale));
      if (!pdf) {
        pdf = new jsPDF({
          orientation,
          unit: "pt",
          format: [pw, ph],
          compress: true,
        });
      } else {
        pdf.addPage([pw, ph], orientation);
      }
      pdf.addImage(dataUrl, "JPEG", 0, 0, pw, ph, undefined, "FAST");
      if (watermark) {
        pdf.setGState(new GState({ opacity: 0.14 }));
        pdf.setTextColor(15, 118, 110);
        pdf.setFontSize(Math.max(24, Math.round(pw / 18)));
        pdf.text(watermark, pw / 2, ph / 2, { align: "center", angle: 35 });
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
  // Normalize to JPEG so print preview always has visible content
  const normalized: string[] = [];
  for (const src of pageDataUrls) {
    const { dataUrl } = await toPdfJpeg(src, 1800);
    normalized.push(dataUrl);
  }
  const parts = normalized
    .map((src) => `<div class="page"><img src="${src}" /></div>`)
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

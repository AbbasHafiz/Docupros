import { jsPDF } from "jspdf";
import { loadImage } from "./imageProcessing";
import { printDataUrl } from "./idPrint";
import {
  escapeHtml,
  openPrintWindow,
  triggerPrintWhenReady,
  writePrintDocument,
} from "./printWindow";
import type { DocumentRecord } from "./types";
import {
  applyWatermarkToPdfPage,
  normalizeWatermark,
  resolveDocWatermark,
  stampWatermarkOnImage,
  type WatermarkOptions,
} from "./watermark";
import { blobFromPdfBase64 } from "./pdfConvert";

/** Keep export pixels close to the source page (only shrink extreme cases). */
const PDF_EXPORT_MAX_SIDE = 6000;
const PDF_EXPORT_JPEG_QUALITY = 0.98;

/**
 * Normalize any image data-URL (PNG/WebP/JPEG) to a JPEG data-URL.
 * jsPDF often renders blank pages when format doesn't match the bytes
 * (e.g. PNG passed as "JPEG") or when images are extremely large.
 */
async function toPdfJpeg(
  src: string,
  maxSide = PDF_EXPORT_MAX_SIDE,
  quality = PDF_EXPORT_JPEG_QUALITY,
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", quality),
    w,
    h,
  };
}

/**
 * True when we can ship the uploaded PDF bytes as-is (no page edits / watermark).
 */
export function canUseOriginalPdf(doc: DocumentRecord): boolean {
  if (!doc.sourcePdfBase64) return false;
  if (resolveDocWatermark(doc)) return false;
  if (!doc.pages.length) return false;
  return doc.pages.every(
    (p) =>
      Boolean(p.imageDataUrl) &&
      (p.filter ?? "original") === "original" &&
      (!p.originalDataUrl || p.imageDataUrl === p.originalDataUrl),
  );
}

/** Prefer original PDF bytes; otherwise build a high-quality PDF from page images. */
export async function exportDocumentPreferOriginal(
  doc: DocumentRecord,
  options?: {
    watermark?: string | WatermarkOptions;
    a4?: boolean;
  },
): Promise<Blob> {
  const watermark = normalizeWatermark(
    options?.watermark ?? resolveDocWatermark(doc) ?? doc.watermark,
  );
  if (!watermark && canUseOriginalPdf(doc) && doc.sourcePdfBase64) {
    return blobFromPdfBase64(doc.sourcePdfBase64);
  }
  const pages = doc.pages.map((p) => p.imageDataUrl).filter(Boolean);
  return exportDocumentPdf(doc.title, pages, {
    watermark: watermark ?? undefined,
    a4: options?.a4,
  });
}

export async function exportDocumentPdf(
  title: string,
  pageDataUrls: string[],
  options?: {
    watermark?: string | WatermarkOptions;
    a4?: boolean;
  },
): Promise<Blob> {
  if (pageDataUrls.length === 0) {
    throw new Error("No pages to export");
  }

  let pdf: jsPDF | null = null;
  const watermark = normalizeWatermark(options?.watermark);

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
      // Full A4/legal scans → fill the PDF page edge-to-edge
      const nearA4 = Math.abs(imgRatio - pageRatio) / pageRatio < 0.1;
      if (nearA4) {
        pdf.addImage(dataUrl, "JPEG", 0, 0, pageW, pageH, undefined, "NONE");
      } else {
        let drawW = pageW;
        let drawH = pageH;
        if (imgRatio > pageRatio) {
          drawH = pageW / imgRatio;
        } else {
          drawW = pageH * imgRatio;
        }
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;
        pdf.addImage(dataUrl, "JPEG", x, y, drawW, drawH, undefined, "NONE");
      }
      if (watermark) {
        await applyWatermarkToPdfPage(pdf, pageW, pageH, watermark, "mm");
      }
    } else {
      const orientation = w >= h ? "l" : "p";
      // Keep page box close to pixel size so viewers don't downscale the embed
      const maxPt = 4500;
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
      pdf.addImage(dataUrl, "JPEG", 0, 0, pw, ph, undefined, "NONE");
      if (watermark) {
        await applyWatermarkToPdfPage(pdf, pw, ph, watermark, "pt");
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
  options?: { watermark?: string | WatermarkOptions | null },
) {
  if (!pageDataUrls.length) return;

  // Open immediately while we still have the user gesture — otherwise browsers
  // leave a blank white tab (especially with noopener) after async work.
  const w = openPrintWindow(title);
  const watermark = normalizeWatermark(options?.watermark);

  try {
    // Higher-res print preview (was 1800) so PDF pages stay sharp
    const normalized: string[] = [];
    for (const src of pageDataUrls) {
      const { dataUrl } = await toPdfJpeg(src, 3600, PDF_EXPORT_JPEG_QUALITY);
      const stamped = watermark
        ? await stampWatermarkOnImage(dataUrl, watermark)
        : dataUrl;
      normalized.push(stamped);
    }
    const parts = normalized
      .map((src) => `<div class="page"><img src="${src}" alt="" /></div>`)
      .join("");
    writePrintDocument(
      w,
      `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4 portrait; margin: 8mm; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .page {
        page-break-after: always;
        break-after: page;
        width: 100%;
        height: 281mm;
        display: grid;
        place-items: center;
        overflow: hidden;
      }
      .page:last-child { page-break-after: auto; break-after: auto; }
      img {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
      }
    </style></head><body>${parts}</body></html>`,
    );
    triggerPrintWhenReady(w);
  } catch (err) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
    throw err;
  }
}

/** Single-page print helper used by ID sheets too. */
export { printDataUrl };

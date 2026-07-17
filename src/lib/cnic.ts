import { jsPDF } from "jspdf";
import { loadImage } from "./imageProcessing";
import { composeIdPrintSheet, printDataUrl } from "./idPrint";

/** Official NADRA CNIC / ISO ID-1 (CR-80) size */
export const CNIC_WIDTH_MM = 85.6;
export const CNIC_HEIGHT_MM = 53.98;
export const CNIC_RATIO = CNIC_WIDTH_MM / CNIC_HEIGHT_MM;
export const CNIC_CORNER_RADIUS_MM = 3.18;

export type CnicExportOptions = {
  front: string;
  back?: string | null;
  title?: string;
  watermark?: string;
  copies?: 1 | 2;
  includeBack?: boolean;
  fitMode?: "fit" | "cover";
};

/** Fit/cover an image into exact CNIC aspect ratio (for scan output). */
export async function normalizeToCnicAspect(
  imageSrc: string,
  longEdgePx = 1700,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const outW = longEdgePx;
  const outH = Math.max(1, Math.round(outW / CNIC_RATIO));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  // Cover: fill the CNIC frame, crop overflow
  const scale = Math.max(outW / img.naturalWidth, outH / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = (outW - dw) / 2;
  const dy = (outH - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  // Soft rounded-corner mask hint (keeps pixels, draws border guide)
  ctx.strokeStyle = "rgba(15, 118, 110, 0.35)";
  ctx.lineWidth = Math.max(2, outW * 0.002);
  const r = (CNIC_CORNER_RADIUS_MM / CNIC_WIDTH_MM) * outW;
  roundRect(ctx, 1, 1, outW - 2, outH - 2, r);
  ctx.stroke();

  return canvas.toDataURL("image/jpeg", 0.95);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Export as exact CNIC-sized PDF pages (85.6 × 53.98 mm).
 * Ideal for sharing / digital CNIC copies.
 */
export async function exportCnicSizedPdf(
  options: CnicExportOptions,
): Promise<Blob> {
  const sides: { src: string; label: string }[] = [
    { src: options.front, label: "CNIC Front" },
  ];
  if (options.back) sides.push({ src: options.back, label: "CNIC Back" });

  let pdf: jsPDF | null = null;

  for (const side of sides) {
    const { dataUrl, w, h } = await toJpegCover(side.src, 1700);
    if (!pdf) {
      pdf = new jsPDF({
        orientation: w >= h ? "l" : "p",
        unit: "mm",
        format: [CNIC_WIDTH_MM, CNIC_HEIGHT_MM],
        compress: true,
      });
    } else {
      pdf.addPage([CNIC_WIDTH_MM, CNIC_HEIGHT_MM], w >= h ? "l" : "p");
    }
    pdf.addImage(dataUrl, "JPEG", 0, 0, CNIC_WIDTH_MM, CNIC_HEIGHT_MM, undefined, "FAST");
    if (options.watermark?.trim()) {
      pdf.setTextColor(15, 118, 110);
      pdf.setFontSize(10);
      pdf.text(options.watermark.trim(), CNIC_WIDTH_MM / 2, CNIC_HEIGHT_MM / 2, {
        align: "center",
        angle: 30,
      });
    }
  }

  if (!pdf) throw new Error("No CNIC sides to export");
  pdf.setProperties({
    title: options.title ?? "Pakistan CNIC",
    subject: "NADRA CNIC 85.6×53.98 mm (ISO ID-1)",
  });
  return pdf.output("blob");
}

async function toJpegCover(src: string, longEdge: number) {
  const normalized = await normalizeToCnicAspect(src, longEdge);
  const img = await loadImage(normalized);
  return {
    dataUrl: normalized,
    w: img.naturalWidth,
    h: img.naturalHeight,
  };
}

/** A4 print sheet with true CNIC card slots (for cutting/printing). */
export async function exportCnicA4Pdf(
  options: CnicExportOptions,
): Promise<Blob> {
  const sheet = await composeIdPrintSheet({
    front: options.front,
    back: options.back,
    title: options.title ?? "Pakistan CNIC",
    copies: options.copies ?? 1,
    includeBack: options.includeBack,
    fitMode: options.fitMode ?? "fit",
    watermark: options.watermark,
    frontLabel: "CNIC Front",
    backLabel: "CNIC Back",
    cardWidthMm: CNIC_WIDTH_MM,
    cardHeightMm: CNIC_HEIGHT_MM,
  });
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  pdf.addImage(sheet, "JPEG", 0, 0, 210, 297, undefined, "FAST");
  pdf.setProperties({
    title: options.title ?? "Pakistan CNIC Print",
    subject: "NADRA CNIC print sheet (85.6×53.98 mm)",
  });
  return pdf.output("blob");
}

export async function printCnic(options: CnicExportOptions) {
  const sheet = await composeIdPrintSheet({
    front: options.front,
    back: options.back,
    title: options.title ?? "Pakistan CNIC",
    copies: options.copies ?? 1,
    includeBack: options.includeBack,
    fitMode: options.fitMode ?? "fit",
    watermark: options.watermark,
    frontLabel: "CNIC Front",
    backLabel: "CNIC Back",
    cardWidthMm: CNIC_WIDTH_MM,
    cardHeightMm: CNIC_HEIGHT_MM,
  });
  printDataUrl(sheet, options.title ?? "CNIC Print");
}

export function cnicFilename(title: string, kind: "card" | "print" = "card") {
  const base = (title || "pakistan-cnic")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase()
    .slice(0, 48);
  return kind === "print" ? `${base || "cnic"}-print-a4.pdf` : `${base || "cnic"}.pdf`;
}

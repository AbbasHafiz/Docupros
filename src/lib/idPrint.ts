import { jsPDF } from "jspdf";
import { loadImage } from "./imageProcessing";
import {
  escapeHtml,
  openPrintWindow,
  triggerPrintWhenReady,
  writePrintDocument,
} from "./printWindow";
import {
  applyWatermarkToCanvas,
  normalizeWatermark,
  type WatermarkOptions,
} from "./watermark";

/** Pakistani CNIC / NADRA / ISO ID-1 (CR-80) */
export const ID_WIDTH_MM = 85.6;
export const ID_HEIGHT_MM = 53.98;

export type IdPrintOptions = {
  front: string;
  back?: string | null;
  title?: string;
  copies?: 1 | 2;
  /** When false, only the front is placed even if back exists. Default true. */
  includeBack?: boolean;
  watermark?: string | WatermarkOptions;
  frontLabel?: string;
  backLabel?: string;
  cardWidthMm?: number;
  cardHeightMm?: number;
  /** fit = whole image in slot (letterbox); cover = fill slot (crop). */
  fitMode?: "fit" | "cover";
};

/** Compose front (+ optional back) onto an A4 page as printable CNIC card(s). */
export async function composeIdPrintSheet(
  options: IdPrintOptions,
): Promise<string> {
  const front = await loadImage(options.front);
  const includeBack = options.includeBack !== false && Boolean(options.back);
  const back = includeBack && options.back ? await loadImage(options.back) : null;
  const copies = options.copies === 2 ? 2 : 1;
  const cardWmm = options.cardWidthMm ?? ID_WIDTH_MM;
  const cardHmm = options.cardHeightMm ?? ID_HEIGHT_MM;
  const frontLabel = options.frontLabel ?? "CNIC Front";
  const backLabel = options.backLabel ?? "CNIC Back";
  const fitMode = options.fitMode ?? "fit";

  // A4 at 200 DPI for sharper print of true mm sizes
  const dpi = 200;
  const pageW = Math.round((210 / 25.4) * dpi);
  const pageH = Math.round((297 / 25.4) * dpi);
  const cardW = Math.round((cardWmm / 25.4) * dpi);
  const cardH = Math.round((cardHmm / 25.4) * dpi);

  const canvas = document.createElement("canvas");
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pageW, pageH);

  // Header
  ctx.fillStyle = "#0b1c24";
  ctx.font = `bold ${Math.round(11 * (dpi / 96))}px sans-serif`;
  ctx.fillText(options.title?.trim() || "Pakistan CNIC", 40, 44);
  ctx.fillStyle = "#64748b";
  ctx.font = `${Math.round(9 * (dpi / 96))}px sans-serif`;
  ctx.fillText(
    `True size ${cardWmm.toFixed(1)} × ${cardHmm.toFixed(1)} mm · A4 sheet · ${copies} copy${copies === 1 ? "" : "ies"}`,
    40,
    68,
  );
  ctx.fillText("Cut along dashed guides", 40, 88);

  const drawCard = (
    img: HTMLImageElement,
    x: number,
    y: number,
    label: string,
  ) => {
    ctx.save();
    // Cut guide (true CNIC outer)
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 2, y - 2, cardW + 4, cardH + 4);
    ctx.setLineDash([]);
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 1, y - 1, cardW + 2, cardH + 2);

    // White card background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, cardW, cardH);

    const scale =
      fitMode === "cover"
        ? Math.max(cardW / img.naturalWidth, cardH / img.naturalHeight)
        : Math.min(cardW / img.naturalWidth, cardH / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = x + (cardW - dw) / 2;
    const dy = y + (cardH - dh) / 2;
    ctx.beginPath();
    ctx.rect(x, y, cardW, cardH);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    ctx.fillStyle = "#0f766e";
    ctx.font = `bold ${Math.round(8.5 * (dpi / 96))}px sans-serif`;
    ctx.fillText(label, x, y - 10);
  };

  const gap = Math.round(10 * (dpi / 96));
  const labelPad = Math.round(22 * (dpi / 96));
  const pairGap = Math.round(28 * (dpi / 96));
  const blockH = back ? cardH * 2 + gap + labelPad * 2 : cardH + labelPad;
  const totalH = copies === 2 ? blockH * 2 + pairGap : blockH;
  const startY = Math.max(
    110,
    Math.round((pageH - totalH) / 2),
  );

  for (let c = 0; c < copies; c++) {
    const baseY = startY + c * (blockH + pairGap);
    const x = Math.round((pageW - cardW) / 2);
    if (copies === 2) {
      ctx.fillStyle = "#64748b";
      ctx.font = `${Math.round(8 * (dpi / 96))}px sans-serif`;
      ctx.fillText(`Copy ${c + 1}`, x, baseY);
    }
    drawCard(front, x, baseY + labelPad, frontLabel);
    if (back) {
      drawCard(
        back,
        x,
        baseY + labelPad + cardH + gap + labelPad,
        backLabel,
      );
    }
  }

  // Footer size reminder
  ctx.fillStyle = "#94a3b8";
  ctx.font = `${Math.round(8 * (dpi / 96))}px sans-serif`;
  ctx.fillText(
    "Print at 100% scale (actual size) — do not use Fit to page",
    40,
    pageH - 28,
  );

  if (options.watermark) {
    const wm = normalizeWatermark(options.watermark);
    if (wm) applyWatermarkToCanvas(ctx, pageW, pageH, wm);
  }

  return canvas.toDataURL("image/jpeg", 0.95);
}

export async function exportIdCardPdf(
  options: IdPrintOptions,
): Promise<Blob> {
  const sheet = await composeIdPrintSheet({
    ...options,
    frontLabel: options.frontLabel ?? "CNIC Front",
    backLabel: options.backLabel ?? "CNIC Back",
  });
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  pdf.addImage(sheet, "JPEG", 0, 0, 210, 297, undefined, "FAST");
  pdf.setProperties({ title: options.title ?? "Pakistan CNIC" });
  return pdf.output("blob");
}

/** Print a single A4 sheet at true physical size (one page). */
export function printDataUrl(
  dataUrl: string,
  title = "Print",
  existingWindow?: Window | null,
) {
  const w = existingWindow ?? openPrintWindow(title);
  writePrintDocument(
    w,
    `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        width: 210mm;
        height: 297mm;
        overflow: hidden;
      }
      img {
        display: block;
        width: 210mm;
        height: 297mm;
        max-width: 210mm;
        max-height: 297mm;
        object-fit: fill;
        page-break-inside: avoid;
        page-break-after: avoid;
      }
      @media screen {
        body { display: grid; place-items: start center; background: #e5e7eb; padding: 12px; width: auto; height: auto; }
        img { box-shadow: 0 8px 24px rgba(0,0,0,.18); }
      }
    </style></head><body>
    <img src="${dataUrl}" alt="Print sheet" />
    </body></html>`,
  );
  triggerPrintWhenReady(w);
}

export async function printIdCard(options: IdPrintOptions) {
  const title = options.title ?? "CNIC Print";
  const w = openPrintWindow(title);
  try {
    const sheet = await composeIdPrintSheet({
      ...options,
      frontLabel: options.frontLabel ?? "CNIC Front",
      backLabel: options.backLabel ?? "CNIC Back",
    });
    printDataUrl(sheet, title, w);
  } catch (err) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
    throw err;
  }
}

import { jsPDF } from "jspdf";
import { loadImage } from "./imageProcessing";

/** Pakistani CNIC / NADRA / ISO ID-1 (CR-80) */
export const ID_WIDTH_MM = 85.6;
export const ID_HEIGHT_MM = 53.98;

export type IdPrintOptions = {
  front: string;
  back?: string | null;
  title?: string;
  copies?: 1 | 2;
  watermark?: string;
  frontLabel?: string;
  backLabel?: string;
  cardWidthMm?: number;
  cardHeightMm?: number;
};

/** Compose front (+ optional back) onto an A4 page as printable CNIC card(s). */
export async function composeIdPrintSheet(
  options: IdPrintOptions,
): Promise<string> {
  const front = await loadImage(options.front);
  const back = options.back ? await loadImage(options.back) : null;
  const copies = options.copies ?? 1;
  const cardWmm = options.cardWidthMm ?? ID_WIDTH_MM;
  const cardHmm = options.cardHeightMm ?? ID_HEIGHT_MM;
  const frontLabel = options.frontLabel ?? "CNIC Front";
  const backLabel = options.backLabel ?? "CNIC Back";

  // A4 at 150 DPI
  const dpi = 150;
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
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(options.title?.trim() || "Pakistan CNIC", 48, 48);
  ctx.fillStyle = "#64748b";
  ctx.font = "14px sans-serif";
  ctx.fillText(
    `Card size ${cardWmm.toFixed(2)} × ${cardHmm.toFixed(2)} mm (NADRA / ISO ID-1)`,
    48,
    72,
  );

  const drawCard = (
    img: HTMLImageElement,
    x: number,
    y: number,
    label: string,
  ) => {
    ctx.save();
    // Cut guide
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 2, y - 2, cardW + 4, cardH + 4);
    ctx.setLineDash([]);
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 1, y - 1, cardW + 2, cardH + 2);
    // Cover-draw into CNIC slot
    const scale = Math.max(cardW / img.naturalWidth, cardH / img.naturalHeight);
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
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(label, x, y - 10);
  };

  const gap = Math.round(14 * (dpi / 96));
  const blockH = back ? cardH * 2 + gap + 36 : cardH + 36;
  const startY = Math.max(
    100,
    Math.round((pageH - (copies === 2 ? blockH * 2 + 48 : blockH)) / 2),
  );

  for (let c = 0; c < copies; c++) {
    const baseY = startY + c * (blockH + 48);
    const x = Math.round((pageW - cardW) / 2);
    if (copies === 2) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px sans-serif";
      ctx.fillText(`Copy ${c + 1}`, x, baseY);
    }
    drawCard(front, x, baseY + 18, frontLabel);
    if (back) {
      drawCard(back, x, baseY + 18 + cardH + gap + 20, backLabel);
    }
  }

  if (options.watermark?.trim()) {
    ctx.save();
    ctx.translate(pageW / 2, pageH / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.font = "bold 48px sans-serif";
    ctx.fillStyle = "rgba(15, 118, 110, 0.12)";
    ctx.textAlign = "center";
    ctx.fillText(options.watermark.trim(), 0, 0);
    ctx.restore();
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

export function printDataUrl(dataUrl: string, title = "Print") {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
  if (!w) {
    throw new Error("Pop-up blocked — allow pop-ups to print");
  }
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      @page { margin: 0; size: A4; }
      html, body { margin: 0; padding: 0; background: #fff; }
      img { width: 100%; height: auto; display: block; }
    </style></head><body>
    <img src="${dataUrl}" onload="setTimeout(()=>{window.focus();window.print();},200)" />
    </body></html>`);
  w.document.close();
}

export async function printIdCard(options: IdPrintOptions) {
  const sheet = await composeIdPrintSheet({
    ...options,
    frontLabel: options.frontLabel ?? "CNIC Front",
    backLabel: options.backLabel ?? "CNIC Back",
  });
  printDataUrl(sheet, options.title ?? "CNIC Print");
}

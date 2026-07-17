import { jsPDF } from "jspdf";
import { loadImage } from "./imageProcessing";

/** ISO ID-1 size in mm */
export const ID_WIDTH_MM = 85.6;
export const ID_HEIGHT_MM = 54;

export type IdPrintOptions = {
  front: string;
  back?: string | null;
  title?: string;
  copies?: 1 | 2;
  watermark?: string;
};

/** Compose front (+ optional back) onto an A4 page as printable ID card(s). */
export async function composeIdPrintSheet(
  options: IdPrintOptions,
): Promise<string> {
  const front = await loadImage(options.front);
  const back = options.back ? await loadImage(options.back) : null;
  const copies = options.copies ?? 1;

  // A4 at 150 DPI
  const dpi = 150;
  const pageW = Math.round((210 / 25.4) * dpi);
  const pageH = Math.round((297 / 25.4) * dpi);
  const cardW = Math.round((ID_WIDTH_MM / 25.4) * dpi);
  const cardH = Math.round((ID_HEIGHT_MM / 25.4) * dpi);

  const canvas = document.createElement("canvas");
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pageW, pageH);

  const drawCard = (
    img: HTMLImageElement,
    x: number,
    y: number,
    label: string,
  ) => {
    ctx.save();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 1, y - 1, cardW + 2, cardH + 2);
    ctx.drawImage(img, x, y, cardW, cardH);
    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.fillText(label, x, y - 8);
    ctx.restore();
  };

  const gap = Math.round(12 * (dpi / 96));
  const blockH = back ? cardH * 2 + gap + 28 : cardH + 28;
  const startY = Math.round((pageH - (copies === 2 ? blockH * 2 + 40 : blockH)) / 2);

  for (let c = 0; c < copies; c++) {
    const baseY = startY + c * (blockH + 40);
    const x = Math.round((pageW - cardW) / 2);
    drawCard(front, x, baseY + 20, "Front");
    if (back) {
      drawCard(back, x, baseY + 20 + cardH + gap + 16, "Back");
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
  const sheet = await composeIdPrintSheet(options);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  pdf.addImage(sheet, "JPEG", 0, 0, 210, 297, undefined, "FAST");
  pdf.setProperties({ title: options.title ?? "ID Card" });
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
  const sheet = await composeIdPrintSheet(options);
  printDataUrl(sheet, options.title ?? "ID Print");
}

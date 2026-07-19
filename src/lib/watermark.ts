import { GState, type jsPDF } from "jspdf";
import type { DocumentRecord, WatermarkLayout, WatermarkOptions } from "./types";

export const DEFAULT_WATERMARK_STYLE: Omit<WatermarkOptions, "text"> = {
  color: "#0f766e",
  opacity: 0.16,
  layout: "center",
  angle: 35,
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Accept legacy string or full options. */
export function normalizeWatermark(
  input?: string | WatermarkOptions | null,
): WatermarkOptions | null {
  if (!input) return null;
  if (typeof input === "string") {
    const text = input.trim();
    if (!text) return null;
    return { text, ...DEFAULT_WATERMARK_STYLE };
  }
  const text = input.text?.trim();
  if (!text) return null;
  return {
    text,
    color: input.color?.trim() || DEFAULT_WATERMARK_STYLE.color,
    opacity: clamp(
      Number.isFinite(input.opacity)
        ? Number(input.opacity)
        : DEFAULT_WATERMARK_STYLE.opacity,
      0.04,
      0.55,
    ),
    layout: input.layout === "full" ? "full" : "center",
    angle: Number.isFinite(input.angle)
      ? Number(input.angle)
      : DEFAULT_WATERMARK_STYLE.angle,
  };
}

export function resolveDocWatermark(
  doc: Pick<DocumentRecord, "watermark" | "watermarkOptions">,
): WatermarkOptions | null {
  return normalizeWatermark(doc.watermarkOptions ?? doc.watermark);
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const raw = hex.trim().replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return { r: 15, g: 118, b: 110 };
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

export function watermarkLabel(options: WatermarkOptions | null | undefined) {
  if (!options?.text?.trim()) return "Watermark";
  return options.layout === "full" ? "Watermark · Full" : "Watermark · On";
}

type PdfUnit = "mm" | "pt";

/** Draw watermark on the current jsPDF page. */
export function applyWatermarkToPdfPage(
  pdf: jsPDF,
  pageW: number,
  pageH: number,
  options: WatermarkOptions,
  unit: PdfUnit = "pt",
) {
  const { r, g, b } = parseHexColor(options.color);
  pdf.setGState(new GState({ opacity: options.opacity }));
  pdf.setTextColor(r, g, b);
  const base =
    unit === "mm"
      ? Math.max(12, Math.round(Math.min(pageW, pageH) / 7))
      : Math.max(22, Math.round(Math.min(pageW, pageH) / 16));
  pdf.setFontSize(base);
  pdf.setFont("helvetica", "bold");

  const drawAt = (x: number, y: number) => {
    pdf.text(options.text, x, y, {
      align: "center",
      angle: options.angle,
    });
  };

  if (options.layout === "full") {
    const cols = 3;
    const rows = 4;
    const stepX = pageW / cols;
    const stepY = pageH / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        drawAt(stepX * (col + 0.5), stepY * (row + 0.5));
      }
    }
  } else {
    drawAt(pageW / 2, pageH / 2);
  }

  pdf.setGState(new GState({ opacity: 1 }));
}

/** Draw watermark on a canvas (CNIC print sheets, previews). */
export function applyWatermarkToCanvas(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  options: WatermarkOptions,
) {
  const { r, g, b } = parseHexColor(options.color);
  const rad = (-options.angle * Math.PI) / 180;
  const fontSize = Math.max(22, Math.round(Math.min(pageW, pageH) / 14));

  ctx.save();
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${options.opacity})`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;

  const drawAt = (x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad);
    ctx.fillText(options.text, 0, 0);
    ctx.restore();
  };

  if (options.layout === "full") {
    const cols = 3;
    const rows = 4;
    const stepX = pageW / cols;
    const stepY = pageH / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        drawAt(stepX * (col + 0.5), stepY * (row + 0.5));
      }
    }
  } else {
    drawAt(pageW / 2, pageH / 2);
  }
  ctx.restore();
}

export type { WatermarkLayout, WatermarkOptions };

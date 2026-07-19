import type { jsPDF } from "jspdf";
import { loadImage } from "./imageProcessing";
import type { DocumentRecord, WatermarkLayout, WatermarkOptions } from "./types";

export const DEFAULT_WATERMARK_STYLE: Omit<WatermarkOptions, "text"> = {
  color: "#0f766e",
  opacity: 0.28,
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
      0.08,
      0.6,
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

/** Draw watermark on a canvas (CNIC print sheets, previews, baked images). */
export function applyWatermarkToCanvas(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  options: WatermarkOptions,
) {
  const { r, g, b } = parseHexColor(options.color);
  const rad = (-options.angle * Math.PI) / 180;
  const fontSize =
    options.layout === "full"
      ? Math.max(28, Math.round(Math.min(pageW, pageH) / 12))
      : Math.max(42, Math.round(Math.min(pageW, pageH) / 8));

  ctx.save();
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${options.opacity})`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${fontSize}px system-ui, Segoe UI, sans-serif`;

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

/** Bake watermark onto an image — used for print / share image. */
export async function stampWatermarkOnImage(
  imageSrc: string,
  options: WatermarkOptions,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, img.naturalWidth);
  canvas.height = Math.max(1, img.naturalHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  applyWatermarkToCanvas(ctx, canvas.width, canvas.height, options);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Transparent PNG overlay matching a page aspect — reliable PDF watermark
 * (jsPDF GState text is often invisible / unsupported).
 */
export async function createWatermarkOverlayDataUrl(
  pageW: number,
  pageH: number,
  options: WatermarkOptions,
  longEdge = 1600,
): Promise<string> {
  const scale = longEdge / Math.max(pageW, pageH, 1);
  const w = Math.max(1, Math.round(pageW * scale));
  const h = Math.max(1, Math.round(pageH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  applyWatermarkToCanvas(ctx, w, h, options);
  return canvas.toDataURL("image/png");
}

/** Draw watermark on the current jsPDF page via PNG overlay. */
export async function applyWatermarkToPdfPage(
  pdf: jsPDF,
  pageW: number,
  pageH: number,
  options: WatermarkOptions,
  _unit: PdfUnit = "pt",
) {
  const overlay = await createWatermarkOverlayDataUrl(pageW, pageH, options);
  pdf.addImage(overlay, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
}

export type { WatermarkLayout, WatermarkOptions };

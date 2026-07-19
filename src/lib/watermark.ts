import type { jsPDF } from "jspdf";
import { loadImage } from "./imageProcessing";
import type { DocumentRecord, WatermarkLayout, WatermarkOptions } from "./types";

export const DEFAULT_WATERMARK_TEXT = "WATERMARK";

export const DEFAULT_WATERMARK_STYLE: Omit<WatermarkOptions, "text"> = {
  color: "#0f766e",
  opacity: 0.32,
  layout: "center",
  angle: 35,
  size: 1,
  spacing: 1,
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
    size: clamp(
      Number.isFinite(input.size) ? Number(input.size) : DEFAULT_WATERMARK_STYLE.size,
      0.4,
      2.5,
    ),
    spacing: clamp(
      Number.isFinite(input.spacing)
        ? Number(input.spacing)
        : DEFAULT_WATERMARK_STYLE.spacing,
      0.5,
      2.5,
    ),
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

/** Grid density for full-page tiling from spacing scale. */
export function watermarkTileGrid(spacing = 1): { cols: number; rows: number } {
  const s = clamp(spacing, 0.5, 2.5);
  return {
    cols: Math.max(2, Math.round(3 / s)),
    rows: Math.max(2, Math.round(4 / s)),
  };
}

type PdfUnit = "mm" | "pt";

function setWmFont(ctx: CanvasRenderingContext2D, size: number) {
  ctx.font = `bold ${size}px system-ui, "Segoe UI", sans-serif`;
}

/** Shrink font until text fits inside maxWidth. */
function fitFontToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  preferred: number,
  maxWidth: number,
  minSize = 9,
): number {
  let size = preferred;
  setWmFont(ctx, size);
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    setWmFont(ctx, size);
  }
  return size;
}

/**
 * Draw watermark clipped to the page — same renderer for preview, PDF, print.
 * Full-page tiles stay inside the page; long text is sized down to fit.
 */
export function applyWatermarkToCanvas(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  options: WatermarkOptions,
) {
  if (pageW < 2 || pageH < 2) return;

  const { r, g, b } = parseHexColor(options.color);
  const rad = (-options.angle * Math.PI) / 180;
  const sizeScale = options.size || 1;
  const spacing = options.spacing || 1;

  ctx.save();
  // Hard clip — nothing can draw outside the page
  ctx.beginPath();
  ctx.rect(0, 0, pageW, pageH);
  ctx.clip();

  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${options.opacity})`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const preferred =
    options.layout === "full"
      ? Math.max(16, Math.round((Math.min(pageW, pageH) / 16) * sizeScale))
      : Math.max(22, Math.round((Math.min(pageW, pageH) / 10) * sizeScale));

  // Keep text within ~65% of page width so rotation doesn't spill badly
  const fontSize = fitFontToWidth(
    ctx,
    options.text,
    preferred,
    pageW * 0.65,
  );
  setWmFont(ctx, fontSize);
  const textW = Math.max(1, ctx.measureText(options.text).width);

  const drawAt = (x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad);
    ctx.fillText(options.text, 0, 0);
    ctx.restore();
  };

  if (options.layout === "full") {
    // Step from text size so long phrases don't overlap / run off edges
    const stepX = Math.max(textW * 1.25, pageW / 3.2) * spacing;
    const stepY = Math.max(fontSize * 3.4, pageH / 5.5) * spacing;
    const startX = stepX * 0.5;
    const startY = stepY * 0.5;
    for (let y = startY; y < pageH; y += stepY) {
      for (let x = startX; x < pageW; x += stepX) {
        drawAt(x, y);
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
 * Transparent PNG overlay matching a page aspect — reliable PDF watermark.
 */
export async function createWatermarkOverlayDataUrl(
  pageW: number,
  pageH: number,
  options: WatermarkOptions,
  longEdge = 2000,
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

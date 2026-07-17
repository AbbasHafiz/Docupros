import { loadImage } from "./imageProcessing";
import { createId } from "./id";

export type CollageItem = {
  id: string;
  src: string;
  /** Normalized 0–1 relative to canvas */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CollagePresetId =
  | "stack2"
  | "side2"
  | "grid2x2"
  | "stack3"
  | "row3"
  | "free";

export const COLLAGE_PRESETS: {
  id: CollagePresetId;
  label: string;
  min: number;
  max: number;
}[] = [
  { id: "stack2", label: "2 stacked", min: 2, max: 2 },
  { id: "side2", label: "2 side-by-side", min: 2, max: 2 },
  { id: "grid2x2", label: "2×2 grid", min: 3, max: 4 },
  { id: "stack3", label: "3 stacked", min: 3, max: 3 },
  { id: "row3", label: "3 in a row", min: 3, max: 3 },
];

const GAP = 0.02;
const MARGIN = 0.04;

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** Build collage slots for a preset from image sources. */
export function layoutCollagePreset(
  sources: string[],
  preset: CollagePresetId,
): CollageItem[] {
  const srcs = sources.filter(Boolean);
  if (!srcs.length) return [];

  const make = (src: string, x: number, y: number, w: number, h: number) => ({
    id: createId(),
    src,
    x,
    y,
    w,
    h,
  });

  if (preset === "stack2" || (preset === "free" && srcs.length === 2)) {
    const h = (1 - MARGIN * 2 - GAP) / 2;
    return srcs.slice(0, 2).map((src, i) =>
      make(src, MARGIN, MARGIN + i * (h + GAP), 1 - MARGIN * 2, h),
    );
  }

  if (preset === "side2") {
    const w = (1 - MARGIN * 2 - GAP) / 2;
    return srcs.slice(0, 2).map((src, i) =>
      make(src, MARGIN + i * (w + GAP), MARGIN, w, 1 - MARGIN * 2),
    );
  }

  if (preset === "stack3") {
    const h = (1 - MARGIN * 2 - GAP * 2) / 3;
    return srcs.slice(0, 3).map((src, i) =>
      make(src, MARGIN, MARGIN + i * (h + GAP), 1 - MARGIN * 2, h),
    );
  }

  if (preset === "row3") {
    const w = (1 - MARGIN * 2 - GAP * 2) / 3;
    return srcs.slice(0, 3).map((src, i) =>
      make(src, MARGIN + i * (w + GAP), MARGIN, w, 1 - MARGIN * 2),
    );
  }

  if (preset === "grid2x2") {
    const w = (1 - MARGIN * 2 - GAP) / 2;
    const h = (1 - MARGIN * 2 - GAP) / 2;
    const positions = [
      [MARGIN, MARGIN],
      [MARGIN + w + GAP, MARGIN],
      [MARGIN, MARGIN + h + GAP],
      [MARGIN + w + GAP, MARGIN + h + GAP],
    ] as const;
    return srcs.slice(0, 4).map((src, i) => {
      const [x, y] = positions[i] ?? positions[0];
      return make(src, x, y, w, h);
    });
  }

  // free / fallback: stack all evenly
  const n = Math.min(srcs.length, 6);
  const h = (1 - MARGIN * 2 - GAP * Math.max(0, n - 1)) / n;
  return srcs.slice(0, n).map((src, i) =>
    make(src, MARGIN, MARGIN + i * (h + GAP), 1 - MARGIN * 2, h),
  );
}

export function suggestPreset(count: number): CollagePresetId {
  if (count <= 1) return "stack2";
  if (count === 2) return "stack2";
  if (count === 3) return "stack3";
  return "grid2x2";
}

/** Keep item inside canvas and enforce minimum size. */
export function normalizeCollageItem(item: CollageItem): CollageItem {
  const min = 0.12;
  let w = clamp01(Math.max(min, item.w));
  let h = clamp01(Math.max(min, item.h));
  let x = clamp01(item.x);
  let y = clamp01(item.y);
  if (x + w > 1) x = 1 - w;
  if (y + h > 1) y = 1 - h;
  return { ...item, x: clamp01(x), y: clamp01(y), w, h };
}

export type CollagePageSize = {
  width: number;
  height: number;
  label: string;
};

export const COLLAGE_PAGE_SIZES: CollagePageSize[] = [
  { width: 1240, height: 1754, label: "A4 portrait" },
  { width: 1754, height: 1240, label: "A4 landscape" },
  { width: 1080, height: 1080, label: "Square" },
  { width: 1080, height: 1920, label: "Story" },
];

/** Render collage items onto a single JPEG page. */
export async function renderCollage(
  items: CollageItem[],
  page: CollagePageSize = COLLAGE_PAGE_SIZES[0],
  background = "#ffffff",
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = page.width;
  canvas.height = page.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, page.width, page.height);

  for (const raw of items) {
    const item = normalizeCollageItem(raw);
    const img = await loadImage(item.src);
    const dx = item.x * page.width;
    const dy = item.y * page.height;
    const dw = item.w * page.width;
    const dh = item.h * page.height;

    // Fit image inside slot (contain) with optional letterbox already as bg
    const scale = Math.min(dw / img.naturalWidth, dh / img.naturalHeight);
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    const ix = dx + (dw - iw) / 2;
    const iy = dy + (dh - ih) / 2;

    ctx.save();
    roundedRectPath(ctx, dx, dy, dw, dh, Math.min(12, dw * 0.03, dh * 0.03));
    ctx.clip();
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(dx, dy, dw, dh);
    ctx.drawImage(img, ix, iy, iw, ih);
    ctx.restore();

    ctx.strokeStyle = "rgba(15, 118, 110, 0.35)";
    ctx.lineWidth = 2;
    roundedRectPath(ctx, dx, dy, dw, dh, Math.min(12, dw * 0.03, dh * 0.03));
    ctx.stroke();
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

function roundedRectPath(
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

export function readFilesAsDataUrls(files: FileList | File[]): Promise<string[]> {
  const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
  return Promise.all(
    list.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Failed to read image"));
          };
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

import { loadImage } from "./imageProcessing";
import type { BBox, EnhanceAdjustments, OcrWord } from "./types";

function clamp(v: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}

async function withCanvas(
  imageSrc: string,
  draw: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    img: HTMLImageElement,
  ) => void | Promise<void>,
  quality = 0.92,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0);
  await draw(ctx, canvas, img);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Sample average color near a stroke for paper-matching erase. */
function samplePaperColor(
  data: ImageData,
  x: number,
  y: number,
  radius: number,
): [number, number, number] {
  const { width, height, data: px } = data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const ring = Math.max(radius + 4, 12);
  for (let dy = -ring; dy <= ring; dy += 2) {
    for (let dx = -ring; dx <= ring; dx += 2) {
      const dist = Math.hypot(dx, dy);
      if (dist < radius + 2 || dist > ring) continue;
      const sx = Math.round(x + dx);
      const sy = Math.round(y + dy);
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      const i = (sy * width + sx) * 4;
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
      n++;
    }
  }
  if (n === 0) return [248, 248, 248];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

export async function eraseAtPoints(
  imageSrc: string,
  points: { x: number; y: number }[],
  brushSize: number,
): Promise<string> {
  return withCanvas(imageSrc, (ctx, canvas) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (const p of points) {
      const [pr, pg, pb] = samplePaperColor(imageData, p.x, p.y, brushSize);
      const r2 = brushSize * brushSize;
      const minX = Math.max(0, Math.floor(p.x - brushSize));
      const maxX = Math.min(canvas.width - 1, Math.ceil(p.x + brushSize));
      const minY = Math.max(0, Math.floor(p.y - brushSize));
      const maxY = Math.min(canvas.height - 1, Math.ceil(p.y + brushSize));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - p.x;
          const dy = y - p.y;
          if (dx * dx + dy * dy > r2) continue;
          const i = (y * canvas.width + x) * 4;
          imageData.data[i] = pr;
          imageData.data[i + 1] = pg;
          imageData.data[i + 2] = pb;
          imageData.data[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  });
}

export async function eraseRegion(
  imageSrc: string,
  bbox: BBox,
  padding = 2,
): Promise<string> {
  return withCanvas(imageSrc, (ctx, canvas) => {
    const x0 = Math.max(0, Math.floor(bbox.x0 - padding));
    const y0 = Math.max(0, Math.floor(bbox.y0 - padding));
    const x1 = Math.min(canvas.width, Math.ceil(bbox.x1 + padding));
    const y1 = Math.min(canvas.height, Math.ceil(bbox.y1 + padding));
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Estimate paper color from border around the box
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    const pad = 8;
    for (let y = Math.max(0, y0 - pad); y < Math.min(canvas.height, y1 + pad); y++) {
      for (let x = Math.max(0, x0 - pad); x < Math.min(canvas.width, x1 + pad); x++) {
        const inside = x >= x0 && x < x1 && y >= y0 && y < y1;
        if (inside) continue;
        const i = (y * canvas.width + x) * 4;
        r += imageData.data[i];
        g += imageData.data[i + 1];
        b += imageData.data[i + 2];
        n++;
      }
    }
    const fill: [number, number, number] =
      n > 0
        ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
        : [250, 250, 250];

    ctx.fillStyle = `rgb(${fill[0]}, ${fill[1]}, ${fill[2]})`;
    ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  });
}

export async function applyEnhanceAdjustments(
  imageSrc: string,
  adj: EnhanceAdjustments,
): Promise<string> {
  const { brightness, contrast, sharpness } = adj;
  if (brightness === 0 && contrast === 0 && sharpness === 0) return imageSrc;

  return withCanvas(imageSrc, (ctx, canvas) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    const c = 1 + contrast / 100;
    const b = brightness * 1.5;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp((data[i] - 128) * c + 128 + b);
      data[i + 1] = clamp((data[i + 1] - 128) * c + 128 + b);
      data[i + 2] = clamp((data[i + 2] - 128) * c + 128 + b);
    }

    if (sharpness > 0) {
      const amount = sharpness / 100;
      const copy = new Uint8ClampedArray(data);
      const w = canvas.width;
      const h = canvas.height;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const center = copy[i + ch] * 5;
            const neighbors =
              copy[((y - 1) * w + x) * 4 + ch] +
              copy[((y + 1) * w + x) * 4 + ch] +
              copy[(y * w + (x - 1)) * 4 + ch] +
              copy[(y * w + (x + 1)) * 4 + ch];
            const sharpened = center - neighbors;
            data[i + ch] = clamp(
              copy[i + ch] * (1 - amount) + sharpened * amount,
            );
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  });
}

export async function rotateImage(
  imageSrc: string,
  degrees: 90 | 180 | 270,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const rad = (degrees * Math.PI) / 180;
  const swap = degrees === 90 || degrees === 270;
  canvas.width = swap ? img.naturalHeight : img.naturalWidth;
  canvas.height = swap ? img.naturalWidth : img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function replaceWordOnImage(
  imageSrc: string,
  word: OcrWord,
  newText: string,
  options?: { fontFamily?: string; color?: string },
): Promise<string> {
  const cleared = await eraseRegion(imageSrc, word.bbox, 3);
  if (!newText.trim()) return cleared;

  return withCanvas(cleared, (ctx) => {
    const { x0, y0, x1, y1 } = word.bbox;
    const boxW = Math.max(8, x1 - x0);
    const boxH = Math.max(8, y1 - y0);
    let fontSize = Math.max(10, Math.floor(boxH * 0.82));
    const family = options?.fontFamily ?? "Arial, Helvetica, sans-serif";
    const color = options?.color ?? "#111111";

    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    // Shrink font to fit width
    for (let i = 0; i < 24; i++) {
      ctx.font = `600 ${fontSize}px ${family}`;
      if (ctx.measureText(newText).width <= boxW * 1.05) break;
      fontSize -= 1;
      if (fontSize < 8) break;
    }

    ctx.font = `600 ${fontSize}px ${family}`;
    ctx.fillText(newText, x0 + 1, y0 + boxH / 2);
  });
}

export async function findReplaceOnImage(
  imageSrc: string,
  words: OcrWord[],
  find: string,
  replace: string,
  all = true,
): Promise<{ image: string; changed: number; remainingWords: OcrWord[] }> {
  const needle = find.trim();
  if (!needle) {
    return { image: imageSrc, changed: 0, remainingWords: words };
  }

  let image = imageSrc;
  let remaining = [...words];
  let changed = 0;
  const lower = needle.toLowerCase();

  for (const word of words) {
    if (word.text.toLowerCase() !== lower) continue;
    image = await replaceWordOnImage(image, word, replace);
    remaining = remaining.filter((w) => w.id !== word.id);
    if (replace.trim()) {
      remaining.push({
        ...word,
        id: word.id,
        text: replace,
      });
    }
    changed++;
    if (!all) break;
  }

  return { image, changed, remainingWords: remaining };
}

export async function drawFreeText(
  imageSrc: string,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color = "#111111",
): Promise<string> {
  if (!text.trim()) return imageSrc;
  return withCanvas(imageSrc, (ctx) => {
    ctx.fillStyle = color;
    ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(text, x, y);
  });
}

export async function drawAnnotationStroke(
  imageSrc: string,
  points: { x: number; y: number }[],
  color: string,
  width: number,
): Promise<string> {
  if (points.length < 2) return imageSrc;
  return withCanvas(imageSrc, (ctx) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  });
}

/** Smart erase: brush that aggressively fills dark marks with paper color. */
export async function smartEraseAtPoints(
  imageSrc: string,
  points: { x: number; y: number }[],
  brushSize: number,
): Promise<string> {
  return withCanvas(imageSrc, (ctx, canvas) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const radius = brushSize * 1.15;
    for (const p of points) {
      const [pr, pg, pb] = samplePaperColor(imageData, p.x, p.y, brushSize);
      // Prefer bright paper sample
      const paperLum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
      const fill: [number, number, number] =
        paperLum > 180 ? [pr, pg, pb] : [248, 248, 248];
      const r2 = radius * radius;
      const minX = Math.max(0, Math.floor(p.x - radius));
      const maxX = Math.min(canvas.width - 1, Math.ceil(p.x + radius));
      const minY = Math.max(0, Math.floor(p.y - radius));
      const maxY = Math.min(canvas.height - 1, Math.ceil(p.y + radius));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - p.x;
          const dy = y - p.y;
          if (dx * dx + dy * dy > r2) continue;
          const i = (y * canvas.width + x) * 4;
          const lum =
            0.299 * imageData.data[i] +
            0.587 * imageData.data[i + 1] +
            0.114 * imageData.data[i + 2];
          // Stronger replace for darker ink/stains; soft blend on midtones
          const t = lum < 200 ? 1 : 0.55;
          imageData.data[i] = clamp(imageData.data[i] * (1 - t) + fill[0] * t);
          imageData.data[i + 1] = clamp(
            imageData.data[i + 1] * (1 - t) + fill[1] * t,
          );
          imageData.data[i + 2] = clamp(
            imageData.data[i + 2] * (1 - t) + fill[2] * t,
          );
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  });
}

export type HandwritingMode = "color" | "thin" | "both";

function isColorInk(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum > 210 || chroma < 28) return false;
  // Blue / cyan pen
  if (b > r + 15 && b > g + 5 && chroma > 28) return true;
  // Red / pink / orange pen
  if (r > g + 20 && r > b + 15 && chroma > 30) return true;
  // Green pen
  if (g > r + 15 && g > b + 10 && chroma > 30) return true;
  // Purple
  if (r > 40 && b > 40 && g < Math.min(r, b) - 10 && chroma > 25) return true;
  return false;
}

function estimateThickness(
  dark: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number,
): number {
  let left = 0;
  let right = 0;
  let up = 0;
  let down = 0;
  for (let i = x; i >= 0 && dark[y * w + i]; i--) left++;
  for (let i = x; i < w && dark[y * w + i]; i++) right++;
  for (let j = y; j >= 0 && dark[j * w + x]; j--) up++;
  for (let j = y; j < h && dark[j * w + x]; j++) down++;
  const horiz = left + right - 1;
  const vert = up + down - 1;
  return Math.min(horiz, vert);
}

function paperFillFromImage(data: ImageData): [number, number, number] {
  const { data: px } = data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  // Sample bright pixels as paper
  for (let i = 0; i < px.length; i += 16) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (lum > 200) {
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
      n++;
    }
  }
  if (n < 50) return [248, 248, 248];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/**
 * Remove handwritten marks from a document scan.
 * - color: blue/red/green pen ink
 * - thin: thin black strokes (pen) while keeping thicker printed text
 * - both: color + thin
 */
export async function removeHandwriting(
  imageSrc: string,
  mode: HandwritingMode = "both",
  aggressiveness = 0.55,
): Promise<string> {
  return withCanvas(imageSrc, (ctx, canvas) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width: w, height: h } = imageData;
    const fill = paperFillFromImage(imageData);
    const thinMax = Math.max(2, Math.round(2 + aggressiveness * 4));
    const darkThresh = Math.round(150 - aggressiveness * 25);

    const removeColor = mode === "color" || mode === "both";
    const removeThin = mode === "thin" || mode === "both";

    const dark = new Uint8Array(w * h);
    if (removeThin) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // Prefer near-gray dark pixels for black pen path
          const chroma =
            Math.max(data[i], data[i + 1], data[i + 2]) -
            Math.min(data[i], data[i + 1], data[i + 2]);
          if (lum < darkThresh && chroma < 40) dark[y * w + x] = 1;
        }
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let wipe = false;

        if (removeColor && isColorInk(r, g, b)) wipe = true;

        if (!wipe && removeThin && dark[y * w + x]) {
          const thick = estimateThickness(dark, w, h, x, y);
          if (thick > 0 && thick <= thinMax) wipe = true;
        }

        if (wipe) {
          data[i] = fill[0];
          data[i + 1] = fill[1];
          data[i + 2] = fill[2];
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  });
}

/** Brush erase that prefers handwriting-like pixels (color ink or thin dark). */
export async function handwritingEraseAtPoints(
  imageSrc: string,
  points: { x: number; y: number }[],
  brushSize: number,
): Promise<string> {
  return withCanvas(imageSrc, (ctx, canvas) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width: w, height: h } = imageData;
    const dark = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < 165) dark[y * w + x] = 1;
      }
    }

    for (const p of points) {
      const [pr, pg, pb] = samplePaperColor(imageData, p.x, p.y, brushSize);
      const r2 = brushSize * brushSize;
      const minX = Math.max(0, Math.floor(p.x - brushSize));
      const maxX = Math.min(w - 1, Math.ceil(p.x + brushSize));
      const minY = Math.max(0, Math.floor(p.y - brushSize));
      const maxY = Math.min(h - 1, Math.ceil(p.y + brushSize));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - p.x;
          const dy = y - p.y;
          if (dx * dx + dy * dy > r2) continue;
          const i = (y * w + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const color = isColorInk(r, g, b);
          const thin =
            dark[y * w + x] && estimateThickness(dark, w, h, x, y) <= 6;
          if (color || thin || lum < 140) {
            data[i] = pr;
            data[i + 1] = pg;
            data[i + 2] = pb;
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  });
}

/** Rectangular crop in image pixel coordinates. */
export async function cropRect(
  imageSrc: string,
  box: BBox,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(img.naturalWidth, Math.ceil(box.x1));
  const y1 = Math.min(img.naturalHeight, Math.ceil(box.y1));
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Place a signature image onto the page. */
export async function applySignature(
  imageSrc: string,
  signatureDataUrl: string,
  x: number,
  y: number,
  width: number,
): Promise<string> {
  const sig = await loadImage(signatureDataUrl);
  const aspect = sig.naturalHeight / Math.max(1, sig.naturalWidth);
  const drawW = width;
  const drawH = width * aspect;
  return withCanvas(imageSrc, (ctx) => {
    ctx.drawImage(sig, x, y, drawW, drawH);
  });
}

export function rebuildDocumentText(pageTexts: (string | undefined)[]): string {
  return pageTexts
    .map((t, i) => {
      const text = (t ?? "").trim();
      if (!text) return "";
      return pageTexts.length > 1 ? `— Page ${i + 1} —\n${text}` : text;
    })
    .filter(Boolean)
    .join("\n\n");
}

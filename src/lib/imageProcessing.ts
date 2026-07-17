import type { Point, Quad, ScanFilter } from "./types";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export function defaultQuad(width: number, height: number): Quad {
  const insetX = width * 0.08;
  const insetY = height * 0.08;
  return {
    tl: { x: insetX, y: insetY },
    tr: { x: width - insetX, y: insetY },
    br: { x: width - insetX, y: height - insetY },
    bl: { x: insetX, y: height - insetY },
  };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function outputSizeFromQuad(quad: Quad) {
  const width = Math.max(
    distance(quad.tl, quad.tr),
    distance(quad.bl, quad.br),
  );
  const height = Math.max(
    distance(quad.tl, quad.bl),
    distance(quad.tr, quad.br),
  );
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

/** Solve for perspective transform matrix mapping src quad → dest rectangle. */
function getPerspectiveTransform(src: Point[], dst: Point[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const [sx, sy] = [src[i].x, src[i].y];
    const [dx, dy] = [dst[i].x, dst[i].y];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  const h = solveLinearSystem(A, b);
  return [...h, 1];
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const div = M[col][col] || 1e-12;
    for (let j = col; j <= n; j++) M[col][j] /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }

  return M.map((row) => row[n]);
}

function applyHomography(h: number[], x: number, y: number): Point {
  const w = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
  };
}

export async function warpPerspective(
  imageSrc: string,
  quad: Quad,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const { width, height } = outputSizeFromQuad(quad);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  const src = [quad.tl, quad.tr, quad.br, quad.bl];
  const dst = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  // Inverse: dest → source, so we can sample
  const h = getPerspectiveTransform(dst, src);

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = img.naturalWidth;
  srcCanvas.height = img.naturalHeight;
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) throw new Error("Canvas unsupported");
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const out = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = applyHomography(h, x + 0.5, y + 0.5);
      const sx = Math.round(p.x);
      const sy = Math.round(p.y);
      const di = (y * width + x) * 4;
      if (sx < 0 || sy < 0 || sx >= srcCanvas.width || sy >= srcCanvas.height) {
        out.data[di] = 255;
        out.data[di + 1] = 255;
        out.data[di + 2] = 255;
        out.data[di + 3] = 255;
        continue;
      }
      const si = (sy * srcCanvas.width + sx) * 4;
      out.data[di] = srcData.data[si];
      out.data[di + 1] = srcData.data[si + 1];
      out.data[di + 2] = srcData.data[si + 2];
      out.data[di + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function clamp(v: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}

export async function applyFilter(
  imageSrc: string,
  filter: ScanFilter,
): Promise<string> {
  if (filter === "original") return imageSrc;

  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    if (filter === "grayscale") {
      data[i] = data[i + 1] = data[i + 2] = gray;
    } else if (filter === "bw") {
      const v = gray > 150 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
    } else if (filter === "soft") {
      data[i] = clamp(r * 0.92 + 18);
      data[i + 1] = clamp(g * 0.92 + 18);
      data[i + 2] = clamp(b * 0.92 + 18);
    } else if (filter === "magic") {
      // Contrast + mild whitening for document look
      const contrast = 1.35;
      const brightness = 12;
      const nr = clamp((r - 128) * contrast + 128 + brightness);
      const ng = clamp((g - 128) * contrast + 128 + brightness);
      const nb = clamp((b - 128) * contrast + 128 + brightness);
      const g2 = 0.299 * nr + 0.587 * ng + 0.114 * nb;
      // Blend toward high-contrast grayscale for paper docs
      data[i] = clamp(nr * 0.35 + g2 * 0.65 + 8);
      data[i + 1] = clamp(ng * 0.35 + g2 * 0.65 + 8);
      data[i + 2] = clamp(nb * 0.35 + g2 * 0.65 + 8);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Lightweight auto-edge: finds bright paper-ish region and returns a quad. */
export async function detectDocumentQuad(imageSrc: string): Promise<Quad> {
  const img = await loadImage(imageSrc);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return defaultQuad(w, h);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum > 140) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found || maxX - minX < canvas.width * 0.25 || maxY - minY < canvas.height * 0.25) {
    return defaultQuad(w, h);
  }

  const pad = 4;
  minX = Math.max(0, minX - pad) / scale;
  minY = Math.max(0, minY - pad) / scale;
  maxX = Math.min(canvas.width, maxX + pad) / scale;
  maxY = Math.min(canvas.height, maxY + pad) / scale;

  return {
    tl: { x: minX, y: minY },
    tr: { x: maxX, y: minY },
    br: { x: maxX, y: maxY },
    bl: { x: minX, y: maxY },
  };
}

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
      const v = gray > 145 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
    } else if (filter === "soft") {
      data[i] = clamp(r * 0.92 + 18);
      data[i + 1] = clamp(g * 0.92 + 18);
      data[i + 2] = clamp(b * 0.92 + 18);
    } else if (filter === "magic") {
      const contrast = 1.4;
      const brightness = 14;
      const nr = clamp((r - 128) * contrast + 128 + brightness);
      const ng = clamp((g - 128) * contrast + 128 + brightness);
      const nb = clamp((b - 128) * contrast + 128 + brightness);
      const g2 = 0.299 * nr + 0.587 * ng + 0.114 * nb;
      data[i] = clamp(nr * 0.3 + g2 * 0.7 + 10);
      data[i + 1] = clamp(ng * 0.3 + g2 * 0.7 + 10);
      data[i + 2] = clamp(nb * 0.3 + g2 * 0.7 + 10);
    } else if (filter === "vivid") {
      const sat = 1.35;
      const avg = (r + g + b) / 3;
      data[i] = clamp(avg + (r - avg) * sat);
      data[i + 1] = clamp(avg + (g - avg) * sat);
      data[i + 2] = clamp(avg + (b - avg) * sat);
      data[i] = clamp((data[i] - 128) * 1.12 + 128);
      data[i + 1] = clamp((data[i + 1] - 128) * 1.12 + 128);
      data[i + 2] = clamp((data[i + 2] - 128) * 1.12 + 128);
    } else if (filter === "whiteboard") {
      // Boost whites, crush mid shadows for marker boards
      const boosted = clamp((gray - 40) * 1.55);
      const ink = gray < 110 ? clamp(gray * 0.55) : boosted;
      data[i] = data[i + 1] = data[i + 2] = ink;
    } else if (filter === "deepen") {
      data[i] = clamp((r - 128) * 1.45 + 128 - 8);
      data[i + 1] = clamp((g - 128) * 1.45 + 128 - 8);
      data[i + 2] = clamp((b - 128) * 1.45 + 128 - 8);
    } else if (filter === "lighten") {
      data[i] = clamp(r * 0.85 + 48);
      data[i + 1] = clamp(g * 0.85 + 48);
      data[i + 2] = clamp(b * 0.85 + 48);
    } else if (filter === "restore") {
      let nr = clamp((r - 128) * 1.28 + 128 + 10);
      let ng = clamp((g - 128) * 1.24 + 128 + 8);
      let nb = clamp((b - 128) * 1.2 + 128 + 5);
      nr = clamp(nr + (255 - nr) * 0.1);
      ng = clamp(ng + (255 - ng) * 0.1);
      nb = clamp(nb + (255 - nb) * 0.08);
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Edge-aware document bounds using luminance + simple gradient. */
export async function detectDocumentQuad(imageSrc: string): Promise<Quad> {
  const img = await loadImage(imageSrc);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  const maxSide = 400;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return defaultQuad(w, h);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = detectDocumentQuadFromImageData(imageData, 1 / scale);
  return result.found ? result.quad : defaultQuad(w, h);
}

export type LiveDetectResult = {
  quad: Quad;
  /** 0–1 how confident the detector is that a document/object is framed */
  confidence: number;
  found: boolean;
};

/**
 * Fast document/object edge detection for a downscaled frame.
 * `outScale` multiplies coordinates back to the source pixel space
 * (e.g. videoWidth / analysisWidth).
 */
export function detectDocumentQuadFromImageData(
  imageData: ImageData,
  outScale = 1,
): LiveDetectResult {
  const cw = imageData.width;
  const ch = imageData.height;
  const { data } = imageData;
  if (cw < 16 || ch < 16) {
    return { quad: defaultQuad(cw * outScale, ch * outScale), confidence: 0, found: false };
  }

  const lum = new Float32Array(cw * ch);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const lumAt = (x: number, y: number) => lum[y * cw + x];

  // Sobel magnitude (skip border)
  const edge = new Float32Array(cw * ch);
  let edgeMean = 0;
  let edgeCount = 0;
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 1; x++) {
      const gx =
        -lumAt(x - 1, y - 1) +
        lumAt(x + 1, y - 1) -
        2 * lumAt(x - 1, y) +
        2 * lumAt(x + 1, y) -
        lumAt(x - 1, y + 1) +
        lumAt(x + 1, y + 1);
      const gy =
        -lumAt(x - 1, y - 1) -
        2 * lumAt(x, y - 1) -
        lumAt(x + 1, y - 1) +
        lumAt(x - 1, y + 1) +
        2 * lumAt(x, y + 1) +
        lumAt(x + 1, y + 1);
      const mag = Math.abs(gx) + Math.abs(gy);
      edge[y * cw + x] = mag;
      edgeMean += mag;
      edgeCount++;
    }
  }
  edgeMean /= Math.max(1, edgeCount);
  const edgeThresh = Math.max(28, edgeMean * 2.2);

  // Sample columns/rows in the central band and walk inward for first strong edge
  const samples = 28;
  const x0 = Math.floor(cw * 0.12);
  const x1 = Math.floor(cw * 0.88);
  const y0 = Math.floor(ch * 0.12);
  const y1 = Math.floor(ch * 0.88);

  const tops: number[] = [];
  const bottoms: number[] = [];
  const lefts: number[] = [];
  const rights: number[] = [];

  for (let i = 0; i < samples; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / (samples - 1));
    let topHit = -1;
    let bottomHit = -1;
    for (let y = 2; y < ch - 2; y++) {
      if (edge[y * cw + x] >= edgeThresh) {
        topHit = y;
        break;
      }
    }
    for (let y = ch - 3; y >= 2; y--) {
      if (edge[y * cw + x] >= edgeThresh) {
        bottomHit = y;
        break;
      }
    }
    if (topHit >= 0 && bottomHit > topHit + ch * 0.12) {
      tops.push(topHit);
      bottoms.push(bottomHit);
    }

    const y = Math.round(y0 + ((y1 - y0) * i) / (samples - 1));
    let leftHit = -1;
    let rightHit = -1;
    for (let xScan = 2; xScan < cw - 2; xScan++) {
      if (edge[y * cw + xScan] >= edgeThresh) {
        leftHit = xScan;
        break;
      }
    }
    for (let xScan = cw - 3; xScan >= 2; xScan--) {
      if (edge[y * cw + xScan] >= edgeThresh) {
        rightHit = xScan;
        break;
      }
    }
    if (leftHit >= 0 && rightHit > leftHit + cw * 0.12) {
      lefts.push(leftHit);
      rights.push(rightHit);
    }
  }

  const median = (arr: number[]) => {
    if (!arr.length) return NaN;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const mad = (arr: number[], med: number) => {
    if (!arr.length) return Infinity;
    const diffs = arr.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
    return diffs[Math.floor(diffs.length / 2)] || 0;
  };

  let minX = median(lefts);
  let maxX = median(rights);
  let minY = median(tops);
  let maxY = median(bottoms);

  const hitScore =
    (tops.length + bottoms.length + lefts.length + rights.length) /
    (samples * 4);
  const stable =
    mad(lefts, minX) < cw * 0.08 &&
    mad(rights, maxX) < cw * 0.08 &&
    mad(tops, minY) < ch * 0.08 &&
    mad(bottoms, maxY) < ch * 0.08;

  // Fallback: bright paper AABB if edge walk is weak
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxY) ||
    maxX - minX < cw * 0.22 ||
    maxY - minY < ch * 0.18 ||
    hitScore < 0.28
  ) {
    const threshold = 125;
    let bMinX = cw;
    let bMinY = ch;
    let bMaxX = 0;
    let bMaxY = 0;
    let found = false;
    for (let y = 1; y < ch - 1; y++) {
      for (let x = 1; x < cw - 1; x++) {
        const L = lumAt(x, y);
        if (L < threshold) continue;
        const gx = Math.abs(lumAt(x + 1, y) - lumAt(x - 1, y));
        const gy = Math.abs(lumAt(x, y + 1) - lumAt(x, y - 1));
        if (L > threshold || gx + gy > 40) {
          found = true;
          if (x < bMinX) bMinX = x;
          if (y < bMinY) bMinY = y;
          if (x > bMaxX) bMaxX = x;
          if (y > bMaxY) bMaxY = y;
        }
      }
    }
    if (!found || bMaxX - bMinX < cw * 0.2 || bMaxY - bMinY < ch * 0.2) {
      return {
        quad: defaultQuad(cw * outScale, ch * outScale),
        confidence: 0,
        found: false,
      };
    }

    const colScore = new Array(cw).fill(0);
    const rowScore = new Array(ch).fill(0);
    for (let y = bMinY; y <= bMaxY; y++) {
      for (let x = bMinX; x <= bMaxX; x++) {
        if (lumAt(x, y) > threshold) {
          colScore[x]++;
          rowScore[y]++;
        }
      }
    }
    const colCut = (bMaxY - bMinY) * 0.12;
    const rowCut = (bMaxX - bMinX) * 0.12;
    while (bMinX < bMaxX && colScore[bMinX] < colCut) bMinX++;
    while (bMaxX > bMinX && colScore[bMaxX] < colCut) bMaxX--;
    while (bMinY < bMaxY && rowScore[bMinY] < rowCut) bMinY++;
    while (bMaxY > bMinY && rowScore[bMaxY] < rowCut) bMaxY--;

    minX = bMinX;
    maxX = bMaxX;
    minY = bMinY;
    maxY = bMaxY;
  }

  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(cw - 1, maxX + pad);
  maxY = Math.min(ch - 1, maxY + pad);

  const areaRatio = ((maxX - minX) * (maxY - minY)) / (cw * ch);
  const sizeOk = areaRatio > 0.08 && areaRatio < 0.92;
  const confidence = Math.max(
    0,
    Math.min(
      1,
      (hitScore * 0.55 + (stable ? 0.25 : 0) + (sizeOk ? 0.2 : 0)) *
        (sizeOk ? 1 : 0.4),
    ),
  );
  const found = confidence >= 0.35 && maxX - minX > cw * 0.2 && maxY - minY > ch * 0.15;

  const s = outScale;
  return {
    found,
    confidence,
    quad: {
      tl: { x: minX * s, y: minY * s },
      tr: { x: maxX * s, y: minY * s },
      br: { x: maxX * s, y: maxY * s },
      bl: { x: minX * s, y: maxY * s },
    },
  };
}

/** Analyze a video frame for live edge overlay. */
export function detectDocumentQuadFromVideo(
  video: HTMLVideoElement,
  maxSide = 280,
  workCanvas?: HTMLCanvasElement,
): LiveDetectResult {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    return { quad: defaultQuad(1, 1), confidence: 0, found: false };
  }
  const scale = Math.min(1, maxSide / Math.max(vw, vh));
  const cw = Math.max(1, Math.round(vw * scale));
  const ch = Math.max(1, Math.round(vh * scale));
  const canvas = workCanvas ?? document.createElement("canvas");
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { quad: defaultQuad(vw, vh), confidence: 0, found: false };
  }
  ctx.drawImage(video, 0, 0, cw, ch);
  const imageData = ctx.getImageData(0, 0, cw, ch);
  return detectDocumentQuadFromImageData(imageData, 1 / scale);
}

/** Map video-pixel quad → overlay element coords with object-fit: cover. */
export function mapVideoQuadToElement(
  quad: Quad,
  video: HTMLVideoElement,
  element: HTMLElement,
): Quad {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const ew = element.clientWidth || 1;
  const eh = element.clientHeight || 1;
  const videoAspect = vw / vh;
  const elemAspect = ew / eh;
  let renderW: number;
  let renderH: number;
  let offsetX: number;
  let offsetY: number;
  if (videoAspect > elemAspect) {
    renderH = eh;
    renderW = eh * videoAspect;
    offsetX = (ew - renderW) / 2;
    offsetY = 0;
  } else {
    renderW = ew;
    renderH = ew / videoAspect;
    offsetX = 0;
    offsetY = (eh - renderH) / 2;
  }
  const map = (p: Point): Point => ({
    x: offsetX + (p.x / vw) * renderW,
    y: offsetY + (p.y / vh) * renderH,
  });
  return {
    tl: map(quad.tl),
    tr: map(quad.tr),
    br: map(quad.br),
    bl: map(quad.bl),
  };
}

/** ID-card friendly default: Pakistani CNIC aspect 85.6 / 53.98. */
export function defaultIdQuad(width: number, height: number): Quad {
  const targetRatio = 85.6 / 53.98;
  let cardW = width * 0.86;
  let cardH = cardW / targetRatio;
  if (cardH > height * 0.7) {
    cardH = height * 0.7;
    cardW = cardH * targetRatio;
  }
  const x0 = (width - cardW) / 2;
  const y0 = (height - cardH) / 2;
  return {
    tl: { x: x0, y: y0 },
    tr: { x: x0 + cardW, y: y0 },
    br: { x: x0 + cardW, y: y0 + cardH },
    bl: { x: x0, y: y0 + cardH },
  };
}

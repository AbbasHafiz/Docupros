import { loadImage } from "./imageProcessing";

export type BgFill =
  | { kind: "transparent" }
  | { kind: "solid"; color: string };

export type BgQuality = "fast" | "balanced" | "best";

export type RemoveBackgroundOptions = {
  fill?: BgFill;
  quality?: BgQuality;
  onProgress?: (label: string, ratio: number) => void;
};

const MODEL: Record<BgQuality, "isnet_quint8" | "isnet_fp16" | "isnet"> = {
  fast: "isnet_quint8",
  balanced: "isnet_fp16",
  best: "isnet",
};

export const BG_FILL_PRESETS: { id: string; label: string; fill: BgFill }[] = [
  { id: "transparent", label: "Transparent", fill: { kind: "transparent" } },
  { id: "white", label: "White", fill: { kind: "solid", color: "#ffffff" } },
  { id: "studio", label: "Studio", fill: { kind: "solid", color: "#e8eef2" } },
  { id: "blue", label: "Blue", fill: { kind: "solid", color: "#1d4ed8" } },
  { id: "black", label: "Black", fill: { kind: "solid", color: "#0f172a" } },
];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read cutout"));
    reader.readAsDataURL(blob);
  });
}

/** Place a transparent PNG onto a solid color (JPEG for document pipeline). */
export async function compositeOnColor(
  transparentSrc: string,
  color: string,
): Promise<string> {
  const img = await loadImage(transparentSrc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, img.naturalWidth);
  canvas.height = Math.max(1, img.naturalHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.93);
}

/**
 * Professional AI background removal (IS-Net via ONNX in the browser).
 * Returns a PNG data URL (transparent) or JPEG when composited on a solid fill.
 */
export async function removeBackground(
  imageSrc: string,
  options: RemoveBackgroundOptions = {},
): Promise<string> {
  const fill = options.fill ?? { kind: "transparent" };
  const quality = options.quality ?? "balanced";

  const { removeBackground: imglyRemoveBackground } = await import(
    "@imgly/background-removal"
  );

  const blob = await imglyRemoveBackground(imageSrc, {
    model: MODEL[quality],
    output: {
      format: "image/png",
      quality: 0.9,
    },
    progress: (key, current, total) => {
      if (!options.onProgress || !total) return;
      const nice =
        key.includes("fetch") || key.includes("download")
          ? "Downloading AI model"
          : key.includes("compute") || key.includes("inference")
            ? "Cutting out subject"
            : "Preparing";
      options.onProgress(nice, Math.min(1, current / total));
    },
  });

  const pngDataUrl = await blobToDataUrl(blob);
  if (fill.kind === "transparent") return pngDataUrl;
  return compositeOnColor(pngDataUrl, fill.color);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  a.click();
}

export function extensionForDataUrl(dataUrl: string) {
  if (dataUrl.startsWith("data:image/png")) return "png";
  if (dataUrl.startsWith("data:image/webp")) return "webp";
  return "jpg";
}

import { Document, Packer, Paragraph, TextRun } from "docx";
import { loadImage } from "./imageProcessing";
import { imagesToLongImage } from "./toolsOps";

export async function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

type PdfJsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJsModule> | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = (async () => {
    const pdfjs = await import("pdfjs-dist");
    const version = pdfjs.version || "5.4.296";
    // Local worker (copied to /public). CDN fallback if local fails to load.
    const local = "/pdf.worker.min.mjs";
    const cdn = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    try {
      const probe = await fetch(local, { method: "HEAD" });
      pdfjs.GlobalWorkerOptions.workerSrc = probe.ok ? local : cdn;
    } catch {
      pdfjs.GlobalWorkerOptions.workerSrc = cdn;
    }
    return pdfjs;
  })();
  return pdfjsPromise;
}

function base64ToUint8(base64: string): Uint8Array {
  const raw = base64.includes(",") ? base64.split(",")[1]! : base64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function pdfFileToImageDataUrls(
  file: ArrayBuffer,
  scale = 1.75,
): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(file);
  const loadingTask = pdfjs.getDocument({
    data,
  });
  const pdf = await loadingTask.promise;
  const urls: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    // Cap long edge so huge bills don't OOM mobile browsers
    const base = page.getViewport({ scale: 1 });
    const maxSide = 2000;
    const fit = Math.min(scale, maxSide / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale: fit });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const renderTask = page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as Parameters<typeof page.render>[0]);
    await renderTask.promise;
    urls.push(canvas.toDataURL("image/jpeg", 0.92));
  }

  if (!urls.length) {
    throw new Error("Could not render PDF pages — try another file");
  }
  return urls;
}

/** Re-render a stored source PDF (base64) into page images. */
export async function pdfBase64ToImageDataUrls(
  sourcePdfBase64: string,
  scale = 1.75,
): Promise<string[]> {
  const bytes = base64ToUint8(sourcePdfBase64);
  // Copy into a fresh ArrayBuffer — pdf.js may detach the view
  const copy = bytes.slice().buffer;
  return pdfFileToImageDataUrls(copy, scale);
}

/** True if this looks like the old blank placeholder import card. */
export function looksLikePdfPlaceholder(dataUrl: string | undefined): boolean {
  if (!dataUrl) return true;
  // Old placeholder was a small white JPEG with text; real bill pages are much larger
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // ~2KB–8KB typical for blank placeholder; real pages usually >> 30KB
  if (b64.length < 12_000) return true;
  return false;
}

export async function pdfFileToLongImage(file: ArrayBuffer): Promise<string> {
  const pages = await pdfFileToImageDataUrls(file, 1.25);
  return imagesToLongImage(pages);
}

export async function textToWordBlob(
  title: string,
  text: string,
): Promise<Blob> {
  const paragraphs = text
    .split(/\n+/)
    .filter(Boolean)
    .map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 160 },
        }),
    );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 32 })],
            spacing: { after: 280 },
          }),
          ...paragraphs,
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function textToExcelCsv(text: string): Promise<Blob> {
  const rows = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes("\t")) return line.split("\t");
      if ((line.match(/,/g) || []).length >= 1)
        return line.split(",").map((c) => c.trim());
      const parts = line.split(/\s{2,}/);
      return parts.length > 1 ? parts : [line];
    });

  const csv = rows
    .map((cols) =>
      cols
        .map((c) => {
          const needs = /[",\n]/.test(c);
          return needs ? `"${c.replace(/"/g, '""')}"` : c;
        })
        .join(","),
    )
    .join("\n");

  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

export async function downloadImagesZip(urls: string[], zipName: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (let i = 0; i < urls.length; i++) {
    const img = await loadImage(urls[i]);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.92),
    );
    if (blob) zip.file(`page-${i + 1}.jpg`, blob);
  }
  const out = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
}

import { Document, Packer, Paragraph, TextRun } from "docx";
import { loadImage } from "./imageProcessing";
import { imagesToLongImage } from "./toolsOps";

export async function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  const pkg = await import("pdfjs-dist/package.json");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pkg.version}/build/pdf.worker.min.mjs`;
  return pdfjs;
}

export async function pdfFileToImageDataUrls(
  file: ArrayBuffer,
  scale = 1.5,
): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(file) }).promise;
  const urls: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as Parameters<typeof page.render>[0]).promise;
    urls.push(canvas.toDataURL("image/jpeg", 0.92));
  }
  return urls;
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

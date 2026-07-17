import type { DocumentRecord, ScanPage, ToolItem } from "./types";
import { createId } from "./id";
import { loadImage } from "./imageProcessing";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const TOOL_SECTIONS: {
  title: string;
  items: ToolItem[];
}[] = [
  {
    title: "Scan",
    items: [
      { id: "id", label: "CNIC Scan", href: "/scan?mode=id_card", color: "#0ea5e9", icon: "🪪", status: "ready" },
      { id: "ocr", label: "Extract Text", href: "/tools/extract-text", color: "#6366f1", icon: "Aa", status: "ready" },
      { id: "idphoto", label: "ID Photo Maker", href: "/tools/id-photo", color: "#8b5cf6", icon: "👤", status: "ready" },
      { id: "book", label: "Book", href: "/scan?mode=book", color: "#f59e0b", icon: "📕", status: "ready" },
      { id: "slides", label: "Slides", href: "/scan?mode=slides", color: "#ef4444", icon: "🖥", status: "ready" },
      { id: "board", label: "Whiteboard", href: "/scan?mode=whiteboard", color: "#14b8a6", icon: "⬜", status: "ready" },
      { id: "time", label: "Timestamp", href: "/tools/timestamp", color: "#64748b", icon: "⏱", status: "ready" },
      { id: "formula", label: "Formula", href: "/tools/soon?name=Formula", color: "#a855f7", icon: "∑", status: "soon" },
      { id: "translate", label: "Photo Translate", href: "/tools/soon?name=Photo%20Translate", color: "#06b6d4", icon: "文A", status: "soon" },
    ],
  },
  {
    title: "Import",
    items: [
      { id: "imp-img", label: "Import Images", href: "/tools/import-images", color: "#22c55e", icon: "🖼", status: "ready" },
      { id: "imp-file", label: "Import Files", href: "/import", color: "#3b82f6", icon: "📁", status: "ready" },
    ],
  },
  {
    title: "Convert",
    items: [
      { id: "word", label: "To Word", href: "/tools/to-word", color: "#2563eb", icon: "W", status: "ready" },
      { id: "excel", label: "To Excel", href: "/tools/to-excel", color: "#16a34a", icon: "X", status: "ready" },
      { id: "ppt", label: "To PPT", href: "/tools/soon?name=To%20PPT", color: "#ea580c", icon: "P", status: "soon" },
      { id: "pdfimg", label: "PDF to Images", href: "/tools/pdf-images", color: "#0d9488", icon: "🖼", status: "ready" },
      { id: "pdflong", label: "PDF to Long Image", href: "/tools/pdf-long", color: "#0891b2", icon: "📜", status: "ready" },
    ],
  },
  {
    title: "Edit",
    items: [
      { id: "sign", label: "Sign", href: "/tools/pick?action=sign", color: "#7c3aed", icon: "✎", status: "ready" },
      { id: "wm", label: "Add Watermark", href: "/tools/pick?action=watermark", color: "#db2777", icon: "©", status: "ready" },
      { id: "smart", label: "Smart Erase", href: "/tools/pick?action=erase", color: "#059669", icon: "⌫", status: "ready" },
      { id: "marks", label: "Erase Marks", href: "/tools/pick?action=erase", color: "#0f766e", icon: "✗", status: "ready" },
      { id: "handwriting", label: "Remove Handwriting", href: "/tools/remove-handwriting", color: "#dc2626", icon: "✍", status: "ready" },
      { id: "restore", label: "Restore Photo", href: "/tools/restore", color: "#c026d3", icon: "✨", status: "ready" },
      { id: "merge", label: "Merge Files", href: "/tools/merge", color: "#4f46e5", icon: "⧉", status: "ready" },
      { id: "extract", label: "Extract Pages", href: "/tools/extract-pages", color: "#0284c7", icon: "▤", status: "ready" },
      { id: "reorder", label: "Reorder Pages", href: "/tools/pick?action=pages", color: "#475569", icon: "↕", status: "ready" },
      { id: "lock", label: "Lock", href: "/tools/lock", color: "#16a34a", icon: "🔒", status: "ready" },
      { id: "form", label: "Form Fill", href: "/tools/pick?action=form", color: "#0f766e", icon: "▦", status: "ready" },
    ],
  },
  {
    title: "Utilities",
    items: [
      { id: "print", label: "Print", href: "/tools/pick?action=print", color: "#334155", icon: "🖨", status: "ready" },
      { id: "idprint", label: "CNIC Print", href: "/scan?mode=id_card", color: "#0ea5e9", icon: "🪪", status: "ready" },
      { id: "qr", label: "Scan Code", href: "/tools/soon?name=Scan%20Code", color: "#111827", icon: "▣", status: "soon" },
      { id: "ai", label: "Docupros AI", href: "/tools/soon?name=Docupros%20AI", color: "#14b8a6", icon: "✦", status: "soon" },
    ],
  },
];

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function mergeDocuments(
  docs: DocumentRecord[],
  title: string,
): Promise<DocumentRecord> {
  const pages: ScanPage[] = docs.flatMap((d) =>
    d.pages.map((p) => ({
      ...p,
      id: createId(),
    })),
  );
  const now = Date.now();
  return {
    id: createId(),
    title,
    pages,
    createdAt: now,
    updatedAt: now,
    thumbnail: pages[0]?.imageDataUrl,
    kind: "document",
  };
}

export async function extractPages(
  doc: DocumentRecord,
  indexes: number[],
  title: string,
): Promise<DocumentRecord> {
  const pages = indexes
    .filter((i) => i >= 0 && i < doc.pages.length)
    .map((i) => ({ ...doc.pages[i], id: createId() }));
  const now = Date.now();
  return {
    id: createId(),
    title,
    pages,
    createdAt: now,
    updatedAt: now,
    thumbnail: pages[0]?.imageDataUrl,
    kind: doc.kind ?? "document",
  };
}

export async function stampTimestamp(
  imageSrc: string,
  text?: string,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0);
  const stamp = text ?? new Date().toLocaleString();
  const pad = Math.round(img.naturalWidth * 0.02);
  ctx.font = `600 ${Math.max(16, Math.round(img.naturalWidth * 0.028))}px sans-serif`;
  const metrics = ctx.measureText(stamp);
  const boxH = Math.round(img.naturalWidth * 0.045);
  const boxW = metrics.width + pad * 2;
  const x = img.naturalWidth - boxW - pad;
  const y = img.naturalHeight - boxH - pad;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(stamp, x + pad, y + boxH / 2);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function restorePhoto(imageSrc: string): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  // Mild denoise + contrast + warm restore
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i];
    let g = px[i + 1];
    let b = px[i + 2];
    r = Math.min(255, (r - 128) * 1.25 + 128 + 8);
    g = Math.min(255, (g - 128) * 1.22 + 128 + 6);
    b = Math.min(255, (b - 128) * 1.18 + 128 + 4);
    // lift shadows
    r = Math.min(255, r + (255 - r) * 0.08);
    g = Math.min(255, g + (255 - g) * 0.08);
    b = Math.min(255, b + (255 - b) * 0.06);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Make a simple ID photo on white background, centered crop. */
export async function makeIdPhoto(
  imageSrc: string,
  opts?: { widthMm?: number; heightMm?: number },
): Promise<string> {
  const wMm = opts?.widthMm ?? 35;
  const hMm = opts?.heightMm ?? 45;
  const dpi = 300;
  const outW = Math.round((wMm / 25.4) * dpi);
  const outH = Math.round((hMm / 25.4) * dpi);
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  const scale = Math.max(outW / img.naturalWidth, outH / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
  return canvas.toDataURL("image/jpeg", 0.95);
}

export async function imagesToLongImage(urls: string[]): Promise<string> {
  if (!urls.length) throw new Error("No images to stitch");
  const images = await Promise.all(urls.map(loadImage));
  const width = Math.max(...images.map((i) => i.naturalWidth));
  const height = images.reduce(
    (sum, i) => sum + Math.round((i.naturalHeight * width) / i.naturalWidth),
    0,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  for (const img of images) {
    const h = Math.round((img.naturalHeight * width) / img.naturalWidth);
    ctx.drawImage(img, 0, y, width, h);
    y += h;
  }
  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function exportPasswordNoticePdf(
  title: string,
  note: string,
): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(title, { x: 50, y: 780, size: 18, font, color: rgb(0.05, 0.05, 0.05) });
  page.drawText(note, { x: 50, y: 740, size: 12, font, color: rgb(0.3, 0.3, 0.3) });
  const bytes = await pdf.save();
  return new Blob([bytes.slice().buffer], { type: "application/pdf" });
}

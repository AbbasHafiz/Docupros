import type { DocumentRecord } from "./types";
import { downloadBlob, exportDocumentPdf } from "./pdf";
import { cnicFilename, exportCnicSizedPdf } from "./cnic";
import { loadImage } from "./imageProcessing";

export type SharePlatform =
  | "system"
  | "whatsapp"
  | "telegram"
  | "email"
  | "sms"
  | "download"
  | "image";

export type PreparedShare = {
  file: File;
  blob: Blob;
  filename: string;
  title: string;
  text: string;
};

function safeFilename(title: string, ext: string) {
  const base = (title || "document")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "document"}.${ext}`;
}

export async function prepareDocumentPdf(
  doc: DocumentRecord,
): Promise<PreparedShare> {
  const title = doc.title || "Docupros document";
  let blob: Blob;
  let filename: string;
  let text: string;

  if (doc.kind === "id_card") {
    const front =
      doc.pages.find((p) => p.side === "front") ?? doc.pages[0];
    const back = doc.pages.find((p) => p.side === "back");
    if (!front) throw new Error("No CNIC front page");
    blob = await exportCnicSizedPdf({
      front: front.imageDataUrl,
      back: back?.imageDataUrl,
      title: doc.title,
      watermark: doc.watermark,
    });
    filename = cnicFilename(doc.title);
    text = `${title} — Pakistan CNIC (85.6×53.98 mm)`;
  } else {
    const pages = doc.pages
      .map((p) => p.imageDataUrl)
      .filter(Boolean);
    if (!pages.length) throw new Error("No pages to share");
    blob = await exportDocumentPdf(title, pages, {
      a4: true,
      watermark: doc.watermark,
    });
    filename = safeFilename(title, "pdf");
    text = `${title} — shared from Docupros`;
  }

  if (blob.size < 500) throw new Error("Share file is empty");

  const file = new File([blob], filename, { type: "application/pdf" });
  return { file, blob, filename, title, text };
}

/** First page (or CNIC front) as a JPEG for image-based sharing. */
export async function prepareDocumentImage(
  doc: DocumentRecord,
): Promise<PreparedShare> {
  const title = doc.title || "Docupros document";
  const page =
    doc.kind === "id_card"
      ? (doc.pages.find((p) => p.side === "front") ?? doc.pages[0])
      : doc.pages[0];
  if (!page?.imageDataUrl) throw new Error("No page image to share");

  const img = await loadImage(page.imageDataUrl);
  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const filename = safeFilename(title, "jpg");
  const file = new File([blob], filename, { type: "image/jpeg" });
  return {
    file,
    blob,
    filename,
    title,
    text: `${title} — shared from Docupros`,
  };
}

export function canUseSystemShare(files?: File[]): boolean {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  if (!files?.length) return true;
  try {
    return navigator.canShare?.({ files }) ?? false;
  } catch {
    return false;
  }
}

export async function shareViaSystem(
  prepared: PreparedShare,
  asFiles = true,
): Promise<"shared" | "aborted" | "unsupported"> {
  if (!navigator.share) return "unsupported";
  try {
    if (asFiles && canUseSystemShare([prepared.file])) {
      await navigator.share({
        title: prepared.title,
        text: prepared.text,
        files: [prepared.file],
      });
      return "shared";
    }
    if (canUseSystemShare()) {
      await navigator.share({
        title: prepared.title,
        text: prepared.text,
      });
      return "shared";
    }
    return "unsupported";
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return "aborted";
    throw e;
  }
}

function encode(text: string) {
  return encodeURIComponent(text);
}

/** Open a platform share URL (text-only; file must be attached by the user or via system share). */
export function openPlatformUrl(
  platform: Exclude<SharePlatform, "system" | "download" | "image">,
  prepared: PreparedShare,
) {
  const { title, text } = prepared;
  const body = `${text}\n\n(Attach the PDF: ${prepared.filename})`;
  let url = "";
  switch (platform) {
    case "whatsapp":
      url = `https://wa.me/?text=${encode(body)}`;
      break;
    case "telegram":
      url = `https://t.me/share/url?url=${encode("https://docupros.vercel.app")}&text=${encode(body)}`;
      break;
    case "email":
      url = `mailto:?subject=${encode(title)}&body=${encode(body)}`;
      break;
    case "sms":
      url = `sms:?&body=${encode(body)}`;
      break;
  }
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export function downloadPrepared(prepared: PreparedShare) {
  downloadBlob(prepared.blob, prepared.filename);
}

/**
 * Share to a platform: prefer native file share, else download PDF + open app URL.
 */
export async function shareToPlatform(
  platform: SharePlatform,
  prepared: PreparedShare,
): Promise<"shared" | "downloaded" | "aborted"> {
  if (platform === "download") {
    downloadPrepared(prepared);
    return "downloaded";
  }

  if (platform === "system" || platform === "image") {
    const result = await shareViaSystem(prepared, true);
    if (result === "shared" || result === "aborted") return result;
    downloadPrepared(prepared);
    return "downloaded";
  }

  // WhatsApp / Telegram / Email / SMS — try file share first on mobile
  if (canUseSystemShare([prepared.file])) {
    const result = await shareViaSystem(prepared, true);
    if (result === "shared" || result === "aborted") return result;
  }

  downloadPrepared(prepared);
  openPlatformUrl(platform, prepared);
  return "downloaded";
}

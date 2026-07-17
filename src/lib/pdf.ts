import { jsPDF } from "jspdf";
import { loadImage } from "./imageProcessing";

export async function exportDocumentPdf(
  title: string,
  pageDataUrls: string[],
): Promise<Blob> {
  if (pageDataUrls.length === 0) {
    throw new Error("No pages to export");
  }

  let pdf: jsPDF | null = null;

  for (const src of pageDataUrls) {
    const img = await loadImage(src);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const orientation = w >= h ? "l" : "p";

    if (!pdf) {
      pdf = new jsPDF({
        orientation,
        unit: "pt",
        format: [w, h],
        compress: true,
      });
    } else {
      pdf.addPage([w, h], orientation);
    }

    pdf.addImage(src, "JPEG", 0, 0, w, h, undefined, "FAST");
  }

  if (!pdf) throw new Error("Failed to create PDF");
  pdf.setProperties({ title });
  return pdf.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

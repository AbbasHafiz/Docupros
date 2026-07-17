import { PDFDocument, StandardFonts, rgb, degrees, PDFTextField, PDFCheckBox } from "pdf-lib";
import { loadImage } from "./imageProcessing";
import type { DocumentRecord, FormField } from "./types";

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function pageImageToPngBytes(dataUrl: string): Promise<Uint8Array> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0);
  const png = canvas.toDataURL("image/png");
  return dataUrlToUint8(png);
}

/** Build a fillable PDF from scanned pages + form field definitions. */
export async function exportFillablePdf(
  doc: DocumentRecord,
  options?: { flatten?: boolean },
): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();
  const flatten = options?.flatten ?? false;

  for (const page of doc.pages) {
    const pngBytes = await pageImageToPngBytes(page.imageDataUrl);
    const image = await pdf.embedPng(pngBytes);
    const pageNode = pdf.addPage([image.width, image.height]);
    pageNode.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    const fields = (doc.formFields ?? []).filter((f) => f.pageId === page.id);
    for (const field of fields) {
      const x = field.x * image.width;
      const y = (1 - field.y - field.h) * image.height;
      const w = Math.max(12, field.w * image.width);
      const h = Math.max(12, field.h * image.height);

      if (flatten) {
        drawFlattenedField(pageNode, font, field, x, y, w, h);
        continue;
      }

      const name = uniqueFieldName(form, field);
      if (field.type === "checkbox") {
        const box = form.createCheckBox(name);
        box.addToPage(pageNode, { x, y, width: Math.min(w, h), height: Math.min(w, h) });
        if (field.checked || field.value === "true" || field.value === "yes") {
          box.check();
        }
      } else if (field.type === "multiline") {
        const tf = form.createTextField(name);
        tf.enableMultiline();
        tf.setText(field.value || "");
        tf.addToPage(pageNode, { x, y, width: w, height: h });
        tf.setFontSize(Math.max(8, Math.min(14, h * 0.35)));
      } else if (field.type === "signature" && field.value.startsWith("data:")) {
        try {
          const sigBytes = dataUrlToUint8(field.value);
          const sigImg = await pdf.embedPng(sigBytes);
          const aspect = sigImg.height / sigImg.width;
          const drawW = w;
          const drawH = Math.min(h, drawW * aspect);
          pageNode.drawImage(sigImg, { x, y, width: drawW, height: drawH });
        } catch {
          const tf = form.createTextField(name);
          tf.setText(field.label || "Signature");
          tf.addToPage(pageNode, { x, y, width: w, height: h });
        }
      } else {
        const tf = form.createTextField(name);
        tf.setText(field.value || "");
        tf.addToPage(pageNode, { x, y, width: w, height: h });
        tf.setFontSize(Math.max(8, Math.min(16, h * 0.55)));
      }
    }
  }

  if (flatten) {
    // nothing — already drawn
  }

  if (doc.watermark?.trim()) {
    const pages = pdf.getPages();
    for (const p of pages) {
      const { width, height } = p.getSize();
      p.drawText(doc.watermark.trim(), {
        x: width * 0.25,
        y: height * 0.5,
        size: 28,
        font,
        color: rgb(0.06, 0.46, 0.43),
        opacity: 0.12,
        rotate: degrees(35),
      });
    }
  }

  const bytes = await pdf.save();
  return new Blob([bytes.slice().buffer], { type: "application/pdf" });
}

function uniqueFieldName(
  form: ReturnType<PDFDocument["getForm"]>,
  field: FormField,
): string {
  const base = (field.name || field.label || field.id)
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 40);
  let name = base || field.id;
  let i = 1;
  while (form.getFields().some((f) => f.getName() === name)) {
    name = `${base}_${i++}`;
  }
  return name;
}

function drawFlattenedField(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  field: FormField,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (field.type === "checkbox") {
    const on = field.checked || field.value === "true" || field.value === "yes";
    page.drawRectangle({
      x,
      y,
      width: Math.min(w, h),
      height: Math.min(w, h),
      borderColor: rgb(0.1, 0.1, 0.1),
      borderWidth: 1,
    });
    if (on) {
      page.drawText("X", {
        x: x + 2,
        y: y + 2,
        size: Math.min(w, h) * 0.7,
        font,
        color: rgb(0.05, 0.05, 0.05),
      });
    }
    return;
  }

  const text = field.value || "";
  if (!text) return;
  const size = Math.max(8, Math.min(14, h * 0.55));
  page.drawText(text, {
    x: x + 2,
    y: y + (h - size) / 2,
    size,
    font,
    color: rgb(0.05, 0.05, 0.05),
    maxWidth: w - 4,
  });
}

/** Load an existing PDF, extract AcroForm fields + rasterize first pages as images via canvas is hard without pdf.js.
 *  For import we keep PDF bytes and list field names/values for filling. */
export async function inspectPdfForm(file: ArrayBuffer): Promise<{
  pageCount: number;
  fields: { name: string; type: string; value: string }[];
  base64: string;
}> {
  const pdf = await PDFDocument.load(file, { ignoreEncryption: true });
  const form = pdf.getForm();
  const fields = form.getFields().map((f) => {
    const name = f.getName();
    let value = "";
    let type = "unknown";
    if (f instanceof PDFTextField) {
      type = "text";
      value = f.getText() ?? "";
    } else if (f instanceof PDFCheckBox) {
      type = "checkbox";
      value = f.isChecked() ? "true" : "false";
    } else {
      type = f.constructor.name.replace("PDF", "").replace("Field", "").toLowerCase();
    }
    return { name, type, value };
  });

  return {
    pageCount: pdf.getPageCount(),
    fields,
    base64: uint8ToBase64(new Uint8Array(file)),
  };
}

export async function fillImportedPdfForm(
  sourcePdfBase64: string,
  values: Record<string, string>,
): Promise<Blob> {
  const bytes = dataUrlToUint8(
    sourcePdfBase64.includes(",")
      ? sourcePdfBase64
      : `data:application/pdf;base64,${sourcePdfBase64}`,
  );
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();

  for (const [name, value] of Object.entries(values)) {
    try {
      const field = form.getFieldMaybe(name);
      if (!field) continue;
      if (field instanceof PDFTextField) {
        field.setText(value);
      } else if (field instanceof PDFCheckBox) {
        const on =
          value === "true" || value === "yes" || value === "1" || value === "on";
        if (on) field.check();
        else field.uncheck();
      }
    } catch {
      // skip incompatible field
    }
  }

  const out = await pdf.save();
  return new Blob([out.slice().buffer], { type: "application/pdf" });
}

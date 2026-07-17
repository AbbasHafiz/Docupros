"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createId } from "@/lib/id";
import { saveDocument } from "@/lib/storage";
import {
  fillImportedPdfForm,
  inspectPdfForm,
} from "@/lib/formPdf";
import { downloadBlob } from "@/lib/pdf";
import { pdfFileToImageDataUrls } from "@/lib/pdfConvert";
import type { DocumentRecord, FormField, ScanPage } from "@/lib/types";
import { documentHref } from "@/lib/routes";

export default function ImportPdfFormPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Imported PDF");
  const [base64, setBase64] = useState<string | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [fields, setFields] = useState<
    { name: string; type: string; value: string }[]
  >([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setStatus("Reading PDF…");
    setPageImages([]);
    try {
      const buffer = await file.arrayBuffer();
      // Clone buffers — pdf.js may detach the ArrayBuffer
      const [info, images] = await Promise.all([
        inspectPdfForm(buffer.slice(0)),
        pdfFileToImageDataUrls(buffer.slice(0), 1.5),
      ]);
      if (!images.length) {
        throw new Error("Could not render any PDF pages");
      }
      setBase64(info.base64);
      setPageImages(images);
      setFields(info.fields);
      setTitle(file.name.replace(/\.pdf$/i, "") || "Imported PDF");
      const initial: Record<string, string> = {};
      for (const f of info.fields) initial[f.name] = f.value;
      setValues(initial);
      setStatus(
        info.fields.length
          ? `Loaded ${images.length} page(s), ${info.fields.length} form field(s)`
          : `Loaded ${images.length} page(s) — no AcroForm fields. You can still view and edit pages.`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to read PDF");
      setBase64(null);
      setPageImages([]);
      setFields([]);
    } finally {
      setBusy(false);
    }
  };

  const exportFilled = async () => {
    if (!base64) return;
    setBusy(true);
    try {
      const blob = await fillImportedPdfForm(base64, values);
      downloadBlob(blob, `${title.replace(/\s+/g, "-").toLowerCase()}-filled.pdf`);
      setStatus("Filled PDF downloaded");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const saveAsDoc = async () => {
    if (!base64 || !pageImages.length) return;
    setBusy(true);
    try {
      const id = createId();
      const now = Date.now();
      const pages: ScanPage[] = pageImages.map((imageDataUrl, i) => ({
        id: createId(),
        imageDataUrl,
        originalDataUrl: imageDataUrl,
        filter: "original",
        createdAt: now + i,
      }));

      const formFields: FormField[] = fields.map((f, i) => ({
        id: createId(),
        pageId: pages[0]?.id ?? "imported",
        type: f.type.includes("check") ? "checkbox" : "text",
        name: f.name,
        label: f.name,
        value: values[f.name] ?? f.value ?? "",
        x: 0.08,
        y: 0.12 + i * 0.06,
        w: 0.5,
        h: 0.04,
        checked: (values[f.name] ?? f.value) === "true",
      }));

      const doc: DocumentRecord = {
        id,
        title,
        kind: fields.length ? "pdf_form" : "document",
        pages,
        formFields: formFields.length ? formFields : undefined,
        sourcePdfBase64: base64,
        createdAt: now,
        updatedAt: now,
        thumbnail: pages[0].imageDataUrl,
      };
      await saveDocument(doc);
      // Open the document viewer so page content is visible
      startTransition(() => router.push(documentHref(id)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <AppHeader title="Import PDF" backHref="/" />
      <main className="home" style={{ paddingBottom: "2rem" }}>
        <p className="hero-copy" style={{ marginBottom: "1.25rem" }}>
          Upload a PDF to view its pages in your library. Fillable forms keep
          their fields for export.
        </p>

        <label className="field">
          <span>PDF file</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>

        {status && (
          <p className="busy-bar" style={{ marginTop: "1rem" }}>
            {busy ? "Working…" : status}
          </p>
        )}

        {pageImages.length > 0 && (
          <div className="page-strip" style={{ marginTop: "1rem" }}>
            {pageImages.map((src, i) => (
              <figure key={i} className="page-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Page ${i + 1}`} />
                <figcaption>Page {i + 1}</figcaption>
              </figure>
            ))}
          </div>
        )}

        {base64 && pageImages.length > 0 && (
          <div className="panel-stack" style={{ marginTop: "1.25rem" }}>
            <label className="field">
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            {fields.length > 0 ? (
              <div className="text-edit-box">
                <p className="subhead">Form fields</p>
                {fields.map((f) => (
                  <label key={f.name} className="field">
                    <span>
                      {f.name} <em style={{ fontWeight: 500 }}>({f.type})</em>
                    </span>
                    {f.type.includes("check") ? (
                      <input
                        type="checkbox"
                        checked={
                          values[f.name] === "true" ||
                          values[f.name] === "yes" ||
                          values[f.name] === "1"
                        }
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [f.name]: e.target.checked ? "true" : "false",
                          }))
                        }
                      />
                    ) : (
                      <input
                        value={values[f.name] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [f.name]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <p className="hint">
                No AcroForm fields in this PDF. Pages still open in the viewer
                for edit, OCR, and export.
              </p>
            )}

            <div className="row-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void saveAsDoc()}
              >
                Save &amp; open
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || fields.length === 0}
                onClick={() => void exportFilled()}
              >
                Export filled PDF
              </button>
              <Link href="/" className="btn-secondary">
                Cancel
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

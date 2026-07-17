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
import type { DocumentRecord, FormField } from "@/lib/types";
import { documentHref } from "@/lib/routes";

export default function ImportPdfFormPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("PDF Form");
  const [base64, setBase64] = useState<string | null>(null);
  const [fields, setFields] = useState<
    { name: string; type: string; value: string }[]
  >([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const buffer = await file.arrayBuffer();
      const info = await inspectPdfForm(buffer);
      setBase64(info.base64);
      setFields(info.fields);
      setTitle(file.name.replace(/\.pdf$/i, "") || "PDF Form");
      const initial: Record<string, string> = {};
      for (const f of info.fields) initial[f.name] = f.value;
      setValues(initial);
      setStatus(
        info.fields.length
          ? `Loaded ${info.pageCount} page(s), ${info.fields.length} form field(s)`
          : `Loaded ${info.pageCount} page(s) — no AcroForm fields found. Save as doc to add fields visually.`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to read PDF");
      setBase64(null);
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
    if (!base64) return;
    setBusy(true);
    try {
      // Create a lightweight doc linked to source PDF for fill list + later form overlay
      const id = createId();
      const formFields: FormField[] = fields.map((f, i) => ({
        id: createId(),
        pageId: "imported",
        type:
          f.type.includes("check")
            ? "checkbox"
            : f.type.includes("text")
              ? "text"
              : "text",
        name: f.name,
        label: f.name,
        value: values[f.name] ?? f.value ?? "",
        x: 0.08,
        y: 0.12 + i * 0.06,
        w: 0.5,
        h: 0.04,
        checked: (values[f.name] ?? f.value) === "true",
      }));

      const canvas = document.createElement("canvas");
      canvas.width = 1240;
      canvas.height = 1754;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#0b1c24";
        ctx.font = "bold 48px sans-serif";
        ctx.fillText(title, 64, 100);
        ctx.fillStyle = "#5b7380";
        ctx.font = "28px sans-serif";
        ctx.fillText("Imported PDF form — use Fill PDF Form to edit values,", 64, 160);
        ctx.fillText("or open Form Fill to add visual fields on scans.", 64, 200);
        fields.slice(0, 12).forEach((f, i) => {
          ctx.fillText(`• ${f.name}`, 64, 280 + i * 40);
        });
      }

      const thumb = canvas.toDataURL("image/jpeg", 0.9);
      const now = Date.now();
      const doc: DocumentRecord = {
        id,
        title,
        kind: "pdf_form",
        pages: [
          {
            id: "imported",
            imageDataUrl: thumb,
            filter: "original",
            createdAt: now,
          },
        ],
        formFields,
        sourcePdfBase64: base64,
        createdAt: now,
        updatedAt: now,
        thumbnail: thumb,
      };
      await saveDocument(doc);
      startTransition(() => router.push(documentHref(id, "pdf-form")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <AppHeader title="Import PDF form" backHref="/" />
      <main className="home" style={{ paddingBottom: "2rem" }}>
        <p className="hero-copy" style={{ marginBottom: "1.25rem" }}>
          Upload a fillable PDF, edit field values, and export a filled copy —
          or save it into your library.
        </p>

        <label className="field">
          <span>PDF file</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>

        {status && <p className="busy-bar" style={{ marginTop: "1rem" }}>{status}</p>}

        {base64 && (
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
                This PDF has no AcroForm fields. Scan pages and use{" "}
                <strong>Form Fill</strong> to place fields visually.
              </p>
            )}

            <div className="row-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={busy || fields.length === 0}
                onClick={() => void exportFilled()}
              >
                Export filled PDF
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void saveAsDoc()}
              >
                Save to library
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

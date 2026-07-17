"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "./AppHeader";
import type { DocumentRecord } from "@/lib/types";
import { deleteDocument, getDocument, saveDocument } from "@/lib/storage";
import { downloadBlob, exportDocumentPdf } from "@/lib/pdf";
import { extractTextFromImages } from "@/lib/ocr";

type Props = { id: string };

export function DocumentViewer({ id }: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [active, setActive] = useState(0);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showOcr, setShowOcr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    void getDocument(id).then((d) => setDoc(d ?? null));
  }, [id]);

  if (!doc) {
    return (
      <div className="center-pad">
        <p className="muted">Document not found.</p>
        <Link href="/" className="btn-primary">
          Back to library
        </Link>
      </div>
    );
  }

  const rename = async () => {
    const title = prompt("Document title", doc.title);
    if (!title?.trim()) return;
    const updated = { ...doc, title: title.trim(), updatedAt: Date.now() };
    await saveDocument(updated);
    setDoc(updated);
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const blob = await exportDocumentPdf(
        doc.title,
        doc.pages.map((p) => p.imageDataUrl),
      );
      downloadBlob(blob, `${doc.title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const runOcr = async () => {
    setOcrRunning(true);
    setOcrProgress(0);
    try {
      const text = await extractTextFromImages(
        doc.pages.map((p) => p.imageDataUrl),
        setOcrProgress,
      );
      const updated = { ...doc, ocrText: text, updatedAt: Date.now() };
      await saveDocument(updated);
      setDoc(updated);
      setShowOcr(true);
    } finally {
      setOcrRunning(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(doc.id);
    startTransition(() => router.push("/"));
  };

  return (
    <div className="doc-view">
      <AppHeader
        title={doc.title}
        backHref="/"
        action={
          <button type="button" className="text-btn" onClick={() => void rename()}>
            Rename
          </button>
        }
      />

      <div className="doc-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={doc.pages[active]?.imageDataUrl}
          alt={`Page ${active + 1}`}
          className="doc-page-image"
        />
      </div>

      {doc.pages.length > 1 && (
        <div className="page-strip compact">
          {doc.pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`page-thumb-btn ${i === active ? "is-active" : ""}`}
              onClick={() => setActive(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageDataUrl} alt={`Page ${i + 1}`} />
            </button>
          ))}
        </div>
      )}

      <div className="doc-toolbar">
        <Link href={`/scan?append=${doc.id}`} className="btn-secondary">
          Add page
        </Link>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void exportPdf()}
          disabled={busy}
        >
          Export PDF
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void runOcr()}
          disabled={ocrRunning}
        >
          {ocrRunning ? `OCR ${ocrProgress}%` : "Extract text"}
        </button>
        <button type="button" className="btn-danger" onClick={() => void remove()}>
          Delete
        </button>
      </div>

      {(showOcr || doc.ocrText) && (
        <section className="ocr-panel">
          <div className="ocr-head">
            <h2>Extracted text</h2>
            <button
              type="button"
              className="text-btn"
              onClick={() => setShowOcr((v) => !v)}
            >
              {showOcr ? "Hide" : "Show"}
            </button>
          </div>
          {showOcr && (
            <textarea
              className="ocr-text"
              readOnly
              value={doc.ocrText || "No text found."}
              rows={10}
            />
          )}
        </section>
      )}
    </div>
  );
}

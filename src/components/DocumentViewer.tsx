"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "./AppHeader";
import type { DocumentRecord } from "@/lib/types";
import { deleteDocument, getDocument, saveDocument } from "@/lib/storage";
import { downloadBlob, exportDocumentPdf } from "@/lib/pdf";
import { extractTextFromImages } from "@/lib/ocr";
import { rebuildDocumentText } from "@/lib/editOperations";

type Props = { id: string };

export function DocumentViewer({ id }: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [active, setActive] = useState(0);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showOcr, setShowOcr] = useState(false);
  const [ocrDraft, setOcrDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getDocument(id).then((d) => {
      if (cancelled) return;
      setDoc(d ?? null);
      if (d?.ocrText) {
        setOcrDraft(d.ocrText);
        setShowOcr(true);
      }
    });
    return () => {
      cancelled = true;
    };
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
      setOcrDraft(text);
      setShowOcr(true);
    } finally {
      setOcrRunning(false);
    }
  };

  const saveOcrText = async () => {
    const pages = doc.pages.map((p, i) =>
      i === active ? { ...p, ocrText: ocrDraft } : p,
    );
    const updated = {
      ...doc,
      pages,
      ocrText: ocrDraft.includes("— Page")
        ? ocrDraft
        : rebuildDocumentText(
            doc.pages.map((p, i) => (i === active ? ocrDraft : p.ocrText)),
          ) || ocrDraft,
      updatedAt: Date.now(),
    };
    await saveDocument(updated);
    setDoc(updated);
  };

  const copyText = async () => {
    const text = ocrDraft || doc.ocrText || "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const remove = async () => {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(doc.id);
    startTransition(() => router.push("/"));
  };

  const activePage = doc.pages[active];

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
          src={activePage?.imageDataUrl}
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
              onClick={() => {
                setActive(i);
                setOcrDraft(p.ocrText || doc.ocrText || "");
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageDataUrl} alt={`Page ${i + 1}`} />
            </button>
          ))}
        </div>
      )}

      <div className="doc-toolbar">
        <Link
          href={`/document/${doc.id}/edit?page=${activePage?.id ?? ""}`}
          className="btn-primary"
        >
          Edit page
        </Link>
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
            <h2>Document text</h2>
            <div className="row-actions">
              <button
                type="button"
                className="text-btn"
                onClick={() => void copyText()}
              >
                Copy
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={() => setShowOcr((v) => !v)}
              >
                {showOcr ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {showOcr && (
            <>
              <textarea
                className="ocr-text"
                value={ocrDraft}
                onChange={(e) => setOcrDraft(e.target.value)}
                rows={10}
                placeholder="Extracted text appears here — edit freely, then save."
              />
              <div className="row-actions" style={{ marginTop: "0.65rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void saveOcrText()}
                >
                  Save text changes
                </button>
                <Link
                  href={`/document/${doc.id}/edit?page=${activePage?.id ?? ""}`}
                  className="btn-secondary"
                >
                  Change text on image
                </Link>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

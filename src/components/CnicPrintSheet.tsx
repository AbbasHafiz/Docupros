"use client";

import { useState } from "react";
import type { DocumentRecord } from "@/lib/types";
import {
  cnicFilename,
  exportCnicA4Pdf,
  exportCnicSizedPdf,
  printCnic,
} from "@/lib/cnic";
import { downloadBlob } from "@/lib/pdf";
import { resolveDocWatermark } from "@/lib/watermark";

type Props = {
  doc: DocumentRecord;
  open: boolean;
  onClose: () => void;
  onStatus?: (message: string | null) => void;
};

export function CnicPrintSheet({ doc, open, onClose, onStatus }: Props) {
  const front =
    doc.pages.find((p) => p.side === "front") ?? doc.pages[0];
  const back = doc.pages.find((p) => p.side === "back");
  const [copies, setCopies] = useState<1 | 2>(1);
  const [includeBack, setIncludeBack] = useState(Boolean(back));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const run = async (action: "print-a4" | "pdf-a4" | "pdf-card") => {
    if (!front) {
      setError("No CNIC front page");
      return;
    }
    setBusy(true);
    setError(null);
    onStatus?.("Preparing CNIC…");
    try {
      const opts = {
        front: front.imageDataUrl,
        back: back?.imageDataUrl,
        title: doc.title,
        watermark: resolveDocWatermark(doc) ?? doc.watermark,
        copies,
        includeBack: includeBack && Boolean(back),
        fitMode: "fit" as const,
      };

      if (action === "print-a4") {
        await printCnic(opts);
        onStatus?.("Print dialog opened — use 100% / Actual size");
        onClose();
        return;
      }

      const blob =
        action === "pdf-card"
          ? await exportCnicSizedPdf(opts)
          : await exportCnicA4Pdf(opts);
      if (blob.size < 500) throw new Error("Export produced an empty file");
      downloadBlob(
        blob,
        cnicFilename(doc.title, action === "pdf-card" ? "card" : "print"),
      );
      onStatus?.(
        action === "pdf-card"
          ? "CNIC card PDF downloaded (85.6×53.98 mm)"
          : `A4 sheet downloaded · ${copies} copy${copies === 1 ? "" : "ies"}`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "CNIC export failed");
      onStatus?.(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop share-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal-sheet share-sheet cnic-print-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cnic-print-title"
      >
        <div className="modal-head">
          <h2 id="cnic-print-title">CNIC print / export</h2>
          <button
            type="button"
            className="text-btn"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <p className="share-doc-title">{doc.title || "Pakistan CNIC"}</p>
        <p className="hint share-hint">
          Cards print at true NADRA size (85.6 × 53.98 mm) on one A4 page. In the
          print dialog choose <strong>100% / Actual size</strong>, not Fit to
          page.
        </p>

        {error && <p className="share-error">{error}</p>}

        <div className="cnic-option-group">
          <p className="subhead">Copies on A4</p>
          <div className="cnic-option-row">
            <button
              type="button"
              className={`btn-secondary ${copies === 1 ? "is-active-btn" : ""}`}
              disabled={busy}
              onClick={() => setCopies(1)}
            >
              1 copy
            </button>
            <button
              type="button"
              className={`btn-secondary ${copies === 2 ? "is-active-btn" : ""}`}
              disabled={busy}
              onClick={() => setCopies(2)}
            >
              2 copies
            </button>
          </div>
        </div>

        {back && (
          <div className="cnic-option-group">
            <p className="subhead">Sides</p>
            <div className="cnic-option-row">
              <button
                type="button"
                className={`btn-secondary ${!includeBack ? "is-active-btn" : ""}`}
                disabled={busy}
                onClick={() => setIncludeBack(false)}
              >
                Front only
              </button>
              <button
                type="button"
                className={`btn-secondary ${includeBack ? "is-active-btn" : ""}`}
                disabled={busy}
                onClick={() => setIncludeBack(true)}
              >
                Front + Back
              </button>
            </div>
          </div>
        )}

        <div className="cnic-action-stack">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !front}
            onClick={() => void run("print-a4")}
          >
            Print A4 (1 page)
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || !front}
            onClick={() => void run("pdf-a4")}
          >
            Download A4 PDF
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || !front}
            onClick={() => void run("pdf-card")}
          >
            Download card-size PDF
          </button>
        </div>
      </div>
    </div>
  );
}

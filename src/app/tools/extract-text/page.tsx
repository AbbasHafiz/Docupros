"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import { extractTextFromImages } from "@/lib/ocr";
import { saveDocument } from "@/lib/storage";
import type { DocumentRecord } from "@/lib/types";

export default function ExtractTextPage() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState("");
  const [docId, setDocId] = useState<string | null>(null);

  const run = async (docs: DocumentRecord[]) => {
    const doc = docs[0];
    if (!doc) return;
    setBusy(true);
    setDocId(doc.id);
    setProgress(0);
    try {
      const ocr = await extractTextFromImages(
        doc.pages.map((p) => p.imageDataUrl),
        setProgress,
      );
      setText(ocr);
      await saveDocument({
        ...doc,
        ocrText: ocr,
        updatedAt: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="Extract Text" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        OCR text from a scanned document.
      </p>
      {!text ? (
        <>
          {busy && <p className="busy-bar">OCR {progress}%</p>}
          <DocPicker onSelect={(d) => void run(d)} />
        </>
      ) : (
        <div className="panel-stack">
          <textarea
            className="ocr-text"
            rows={16}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void navigator.clipboard.writeText(text)}
            >
              Copy
            </button>
            {docId && (
              <a className="btn-primary" href={`/document/${docId}`}>
                Open document
              </a>
            )}
            <button type="button" className="text-btn" onClick={() => setText("")}>
              Another
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

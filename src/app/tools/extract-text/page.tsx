"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import { extractTextFromImages } from "@/lib/ocr";
import { saveDocument } from "@/lib/storage";
import type { DocumentRecord } from "@/lib/types";
import { documentHref } from "@/lib/routes";

export default function ExtractTextPage() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState("");
  const [docId, setDocId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async (docs: DocumentRecord[]) => {
    const doc = docs[0];
    if (!doc) return;
    setBusy(true);
    setDocId(doc.id);
    setProgress(0);
    setDone(false);
    try {
      const ocr = await extractTextFromImages(
        doc.pages.map((p) => p.imageDataUrl),
        setProgress,
      );
      setText(ocr);
      setDone(true);
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
      {!done ? (
        <>
          {busy && <p className="busy-bar">OCR {progress}%</p>}
          <DocPicker onSelect={(d) => void run(d)} />
        </>
      ) : (
        <div className="panel-stack">
          {text ? (
            <textarea
              className="ocr-text"
              rows={16}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <p className="hint">No text detected on this document.</p>
          )}
          <div className="row-actions">
            {text && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void navigator.clipboard.writeText(text)}
              >
                Copy
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={!docId}
              onClick={() =>
                void (async () => {
                  if (!docId) return;
                  const { getDocument, saveDocument } = await import(
                    "@/lib/storage"
                  );
                  const d = await getDocument(docId);
                  if (!d) return;
                  await saveDocument({
                    ...d,
                    ocrText: text,
                    updatedAt: Date.now(),
                  });
                  window.location.href = documentHref(docId);
                })()
              }
            >
              Save &amp; open
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setText("");
                setDone(false);
                setDocId(null);
              }}
            >
              Another
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

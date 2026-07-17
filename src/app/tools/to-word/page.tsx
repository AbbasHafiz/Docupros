"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import { extractTextFromImages } from "@/lib/ocr";
import { textToWordBlob } from "@/lib/pdfConvert";
import { downloadBlob } from "@/lib/pdf";
import type { DocumentRecord } from "@/lib/types";

export default function ToWordPage() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("Document");

  const run = async (docs: DocumentRecord[]) => {
    const doc = docs[0];
    if (!doc) return;
    setBusy(true);
    setTitle(doc.title);
    setStatus("Extracting text…");
    try {
      const ocr =
        doc.ocrText ||
        (await extractTextFromImages(doc.pages.map((p) => p.imageDataUrl)));
      setText(ocr);
      setStatus("Ready — edit text then download Word");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "OCR failed");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await textToWordBlob(title, text || " ");
      downloadBlob(blob, `${title.replace(/\s+/g, "-").toLowerCase()}.docx`);
      setStatus("Word file downloaded");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="To Word" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        OCR your scan into editable text, then export a .docx file.
      </p>
      {!text ? (
        <DocPicker onSelect={(d) => void run(d)} />
      ) : (
        <div className="panel-stack">
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <textarea
            className="ocr-text"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void download()}
          >
            Download Word
          </button>
          <button type="button" className="text-btn" onClick={() => setText("")}>
            Choose another
          </button>
        </div>
      )}
      {status && <p className="busy-bar">{busy ? "Working…" : status}</p>}
    </main>
  );
}

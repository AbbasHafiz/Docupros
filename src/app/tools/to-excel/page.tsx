"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import { extractTextFromImages } from "@/lib/ocr";
import { textToExcelCsv } from "@/lib/pdfConvert";
import { downloadBlob } from "@/lib/pdf";
import type { DocumentRecord } from "@/lib/types";

export default function ToExcelPage() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("table");

  const run = async (docs: DocumentRecord[]) => {
    const doc = docs[0];
    if (!doc) return;
    setBusy(true);
    setTitle(doc.title);
    setStatus("Extracting…");
    try {
      const ocr =
        doc.ocrText ||
        (await extractTextFromImages(doc.pages.map((p) => p.imageDataUrl)));
      setText(ocr);
      setStatus("Ready — tweak rows then download CSV (Excel)");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const blob = await textToExcelCsv(text || " ");
    downloadBlob(blob, `${title.replace(/\s+/g, "-").toLowerCase()}.csv`);
    setStatus("CSV downloaded — open in Excel");
  };

  return (
    <main className="home">
      <AppHeader title="To Excel" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        Converts OCR text to CSV (open in Excel). Best with tabular scans.
      </p>
      {!text ? (
        <DocPicker onSelect={(d) => void run(d)} />
      ) : (
        <div className="panel-stack">
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
            Download CSV
          </button>
          <button type="button" className="text-btn" onClick={() => setText("")}>
            Choose another
          </button>
        </div>
      )}
      {status && <p className="busy-bar">{status}</p>}
    </main>
  );
}

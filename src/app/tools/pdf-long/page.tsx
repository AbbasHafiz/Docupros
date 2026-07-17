"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { downloadDataUrl, pdfFileToLongImage } from "@/lib/pdfConvert";
import { DocPicker } from "@/components/DocPicker";
import { imagesToLongImage } from "@/lib/toolsOps";
import type { DocumentRecord } from "@/lib/types";

export default function PdfLongPage() {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const fromPdf = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const long = await pdfFileToLongImage(await file.arrayBuffer());
      setPreview(long);
      setStatus("Long image ready");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const fromDoc = async (docs: DocumentRecord[]) => {
    const doc = docs[0];
    if (!doc) return;
    setBusy(true);
    try {
      const long = await imagesToLongImage(doc.pages.map((p) => p.imageDataUrl));
      setPreview(long);
      setStatus("Long image ready");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="PDF to Long Image" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        Stack pages vertically into one long image (from PDF or a saved doc).
      </p>
      <label className="field">
        <span>PDF file</span>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => void fromPdf(e.target.files?.[0])}
        />
      </label>
      <p className="subhead" style={{ marginTop: "1rem" }}>
        Or pick a document
      </p>
      <DocPicker onSelect={(d) => void fromDoc(d)} />
      {status && <p className="busy-bar">{busy ? "Working…" : status}</p>}
      {preview && (
        <div className="panel-stack" style={{ marginTop: "1rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Long image"
            style={{ width: "100%", borderRadius: 12 }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => void downloadDataUrl(preview, "long-image.jpg")}
          >
            Download
          </button>
        </div>
      )}
    </main>
  );
}

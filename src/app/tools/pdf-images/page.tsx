"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  downloadDataUrl,
  downloadImagesZip,
  pdfFileToImageDataUrls,
} from "@/lib/pdfConvert";

export default function PdfImagesPage() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setStatus("Rendering pages…");
    try {
      const urls = await pdfFileToImageDataUrls(await file.arrayBuffer());
      setPreviews(urls);
      setStatus(`${urls.length} page(s) ready`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
      setPreviews([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="PDF to Images" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        Convert each PDF page into a JPEG image.
      </p>
      <label className="field">
        <span>PDF file</span>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      {status && <p className="busy-bar">{busy ? "Working…" : status}</p>}
      {previews.length > 0 && (
        <div className="panel-stack" style={{ marginTop: "1rem" }}>
          <div className="page-strip">
            {previews.map((src, i) => (
              <figure key={i} className="page-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Page ${i + 1}`} />
                <figcaption>Page {i + 1}</figcaption>
              </figure>
            ))}
          </div>
          <div className="row-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void downloadImagesZip(previews, "pdf-pages.zip")}
            >
              Download ZIP
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                previews.forEach((src, i) =>
                  void downloadDataUrl(src, `page-${i + 1}.jpg`),
                )
              }
            >
              Download each
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

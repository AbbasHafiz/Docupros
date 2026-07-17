"use client";

import { useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { makeIdPhoto } from "@/lib/toolsOps";

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function IdPhotoPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Failed"));
        reader.readAsDataURL(file);
      });
      const out = await makeIdPhoto(dataUrl);
      setPreview(out);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="ID Photo Maker" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        Crop a portrait into a standard 35×45 mm ID photo on a white background.
      </p>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => inputRef.current?.click()}
      >
        Choose photo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {busy && <p className="busy-bar">Processing…</p>}
      {preview && (
        <div className="panel-stack" style={{ marginTop: "1rem", maxWidth: 280 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="ID photo"
            style={{ width: "100%", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => void downloadDataUrl(preview, "id-photo.jpg")}
          >
            Download
          </button>
        </div>
      )}
    </main>
  );
}

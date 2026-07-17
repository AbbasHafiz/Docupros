"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createId } from "@/lib/id";
import { saveDocument } from "@/lib/storage";
import type { DocumentRecord, ScanPage } from "@/lib/types";
import { documentHref } from "@/lib/routes";

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

export default function ImportImagesPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Imported images");

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      const pages: ScanPage[] = [];
      for (const file of Array.from(list)) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await readFile(file);
        pages.push({
          id: createId(),
          imageDataUrl: dataUrl,
          originalDataUrl: dataUrl,
          filter: "original",
          createdAt: Date.now(),
        });
      }
      if (!pages.length) {
        alert("No images selected");
        return;
      }
      const now = Date.now();
      const doc: DocumentRecord = {
        id: createId(),
        title: title.trim() || "Imported images",
        pages,
        createdAt: now,
        updatedAt: now,
        thumbnail: pages[0].imageDataUrl,
        kind: "document",
      };
      await saveDocument(doc);
      startTransition(() => router.push(documentHref(doc.id)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="Import Images" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        Import photos from your gallery into a new Docupros document.
      </p>
      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field" style={{ marginTop: "0.75rem" }}>
        <span>Images</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => void onFiles(e.target.files)}
        />
      </label>
      {busy && <p className="busy-bar">Importing…</p>}
    </main>
  );
}

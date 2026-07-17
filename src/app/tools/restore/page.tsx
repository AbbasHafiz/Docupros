"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import { saveDocument } from "@/lib/storage";
import { restorePhoto } from "@/lib/toolsOps";
import type { DocumentRecord } from "@/lib/types";
import { documentHref } from "@/lib/routes";

export default function RestorePage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const run = async (docs: DocumentRecord[]) => {
    const doc = docs[0];
    if (!doc) return;
    setBusy(true);
    try {
      const pages = [];
      for (const p of doc.pages) {
        const imageDataUrl = await restorePhoto(p.imageDataUrl);
        pages.push({
          ...p,
          originalDataUrl: p.originalDataUrl ?? p.imageDataUrl,
          imageDataUrl,
          filter: "restore" as const,
        });
      }
      const updated = {
        ...doc,
        pages,
        thumbnail: pages[0]?.imageDataUrl,
        updatedAt: Date.now(),
      };
      await saveDocument(updated);
      startTransition(() => router.push(documentHref(doc.id)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="Restore Photo" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        Lift shadows, boost contrast, and warm tones on faded scans/photos.
      </p>
      {busy && <p className="busy-bar">Restoring…</p>}
      <DocPicker onSelect={(d) => void run(d)} />
    </main>
  );
}

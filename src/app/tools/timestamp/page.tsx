"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import { saveDocument } from "@/lib/storage";
import { stampTimestamp } from "@/lib/toolsOps";
import type { DocumentRecord } from "@/lib/types";

export default function TimestampPage() {
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const run = async (docs: DocumentRecord[]) => {
    const doc = docs[0];
    if (!doc) return;
    setBusy(true);
    try {
      const pages = [];
      for (const p of doc.pages) {
        const imageDataUrl = await stampTimestamp(
          p.imageDataUrl,
          custom.trim() || undefined,
        );
        pages.push({ ...p, imageDataUrl });
      }
      const updated = {
        ...doc,
        pages,
        thumbnail: pages[0]?.imageDataUrl,
        updatedAt: Date.now(),
      };
      await saveDocument(updated);
      setStatus("Timestamp stamped on all pages");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="Timestamp" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        Stamp date/time (or custom text) onto every page.
      </p>
      <label className="field">
        <span>Custom stamp (optional)</span>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Leave blank for current date/time"
        />
      </label>
      <div style={{ marginTop: "1rem" }}>
        <DocPicker onSelect={(d) => void run(d)} />
      </div>
      {(busy || status) && (
        <p className="busy-bar">{busy ? "Stamping…" : status}</p>
      )}
    </main>
  );
}

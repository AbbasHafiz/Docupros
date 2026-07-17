"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import { saveDocument } from "@/lib/storage";
import { mergeDocuments } from "@/lib/toolsOps";
import type { DocumentRecord } from "@/lib/types";

export default function MergePage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Merged document");

  const onSelect = async (docs: DocumentRecord[]) => {
    if (docs.length < 2) {
      alert("Select at least 2 documents");
      return;
    }
    setBusy(true);
    try {
      const merged = await mergeDocuments(docs, title.trim() || "Merged document");
      await saveDocument(merged);
      startTransition(() => router.push(`/document/${merged.id}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="Merge Files" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        Select multiple documents to combine into one PDF-ready file.
      </p>
      <label className="field">
        <span>Merged title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      {busy && <p className="busy-bar">Merging…</p>}
      <div style={{ marginTop: "1rem" }}>
        <DocPicker multiple onSelect={(d) => void onSelect(d)} />
      </div>
    </main>
  );
}

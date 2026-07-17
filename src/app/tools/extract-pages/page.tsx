"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import { saveDocument } from "@/lib/storage";
import { extractPages } from "@/lib/toolsOps";
import type { DocumentRecord } from "@/lib/types";

export default function ExtractPagesPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!doc || picked.size === 0) return;
    setBusy(true);
    try {
      const indexes = [...picked].sort((a, b) => a - b);
      const created = await extractPages(
        doc,
        indexes,
        `${doc.title} (extracted)`,
      );
      await saveDocument(created);
      startTransition(() => router.push(`/document/${created.id}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="Extract Pages" backHref="/tools" />
      {!doc ? (
        <div style={{ marginTop: "1rem" }}>
          <DocPicker onSelect={(d) => setDoc(d[0])} />
        </div>
      ) : (
        <div className="panel-stack" style={{ marginTop: "1rem" }}>
          <p>
            <strong>{doc.title}</strong> — select pages to extract
          </p>
          <div className="page-strip">
            {doc.pages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`page-thumb-btn ${picked.has(i) ? "is-active" : ""}`}
                onClick={() =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageDataUrl} alt={`Page ${i + 1}`} />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || picked.size === 0}
            onClick={() => void run()}
          >
            Extract {picked.size || ""} page(s)
          </button>
          <button type="button" className="text-btn" onClick={() => setDoc(null)}>
            Choose another
          </button>
        </div>
      )}
    </main>
  );
}

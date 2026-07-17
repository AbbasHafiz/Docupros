"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import {
  removeHandwriting,
  type HandwritingMode,
} from "@/lib/editOperations";
import { saveDocument } from "@/lib/storage";
import type { DocumentRecord } from "@/lib/types";
import { documentHref } from "@/lib/routes";

export default function RemoveHandwritingPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<HandwritingMode>("both");
  const [strength, setStrength] = useState(55);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const process = async (docs: DocumentRecord[]) => {
    const d = docs[0];
    if (!d?.pages.length) return;
    setDoc(d);
    setPageIndex(0);
    setBusy(true);
    setStatus("Removing handwriting…");
    try {
      const pages = [];
      for (const p of d.pages) {
        const imageDataUrl = await removeHandwriting(
          p.imageDataUrl,
          mode,
          strength / 100,
        );
        pages.push({
          ...p,
          originalDataUrl: p.originalDataUrl ?? p.imageDataUrl,
          imageDataUrl,
        });
      }
      const updated = {
        ...d,
        pages,
        thumbnail: pages[0]?.imageDataUrl,
        updatedAt: Date.now(),
      };
      await saveDocument(updated);
      setDoc(updated);
      setPreview(pages[0]?.imageDataUrl ?? null);
      setStatus("Handwriting removed on all pages");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const reprocessCurrent = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      const pages = [...doc.pages];
      const src =
        pages[pageIndex].originalDataUrl ?? pages[pageIndex].imageDataUrl;
      const imageDataUrl = await removeHandwriting(src, mode, strength / 100);
      pages[pageIndex] = {
        ...pages[pageIndex],
        originalDataUrl: pages[pageIndex].originalDataUrl ?? src,
        imageDataUrl,
      };
      const updated = {
        ...doc,
        pages,
        thumbnail: pages[0]?.imageDataUrl,
        updatedAt: Date.now(),
      };
      await saveDocument(updated);
      setDoc(updated);
      setPreview(imageDataUrl);
      setStatus("Page updated");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home">
      <AppHeader title="Remove Handwriting" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        Strip pen marks from scans while keeping printed text. Best on blue/red
        ink; thin black strokes use stroke-thickness detection.
      </p>

      <div className="panel-stack">
        <p className="subhead">Mode</p>
        <div className="row-actions">
          {(
            [
              ["both", "Color + thin"],
              ["color", "Color ink"],
              ["thin", "Thin black"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`mini-chip ${mode === id ? "is-active" : ""}`}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="slider-row">
          <span>Strength {strength}%</span>
          <input
            type="range"
            min={20}
            max={90}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
          />
        </label>
      </div>

      {!doc ? (
        <div style={{ marginTop: "1rem" }}>
          <DocPicker onSelect={(d) => void process(d)} />
        </div>
      ) : (
        <div className="panel-stack" style={{ marginTop: "1rem" }}>
          <p>
            <strong>{doc.title}</strong>
          </p>
          {doc.pages.length > 1 && (
            <div className="page-strip compact">
              {doc.pages.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={`page-thumb-btn ${i === pageIndex ? "is-active" : ""}`}
                  onClick={() => {
                    setPageIndex(i);
                    setPreview(p.imageDataUrl);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageDataUrl} alt={`Page ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Preview"
              style={{
                width: "100%",
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              }}
            />
          )}
          <div className="row-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void reprocessCurrent()}
            >
              Re-run on this page
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                startTransition(() => router.push(documentHref(doc.id, "edit")))
              }
            >
              Fine-tune with brush
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setDoc(null);
                setPreview(null);
              }}
            >
              Another document
            </button>
          </div>
        </div>
      )}

      {(busy || status) && (
        <p className="busy-bar">{busy ? "Working…" : status}</p>
      )}
    </main>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DocPicker } from "@/components/DocPicker";
import { saveDocument } from "@/lib/storage";
import type { DocumentRecord } from "@/lib/types";
import { documentHref } from "@/lib/routes";
import { createId } from "@/lib/id";
import {
  BG_FILL_PRESETS,
  downloadDataUrl,
  extensionForDataUrl,
  removeBackground,
  type BgFill,
  type BgQuality,
} from "@/lib/removeBackground";

type SourceMode = "upload" | "document";

export default function RemoveBackgroundPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [quality, setQuality] = useState<BgQuality>("balanced");
  const [fillId, setFillId] = useState("transparent");
  const [customColor, setCustomColor] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const resolveFill = (): BgFill => {
    if (fillId === "custom") return { kind: "solid", color: customColor };
    return (
      BG_FILL_PRESETS.find((p) => p.id === fillId)?.fill ?? {
        kind: "transparent",
      }
    );
  };

  const runOnSrc = async (src: string) => {
    setBusy(true);
    setError(null);
    setProgress("Loading AI model…");
    setResult(null);
    try {
      const out = await removeBackground(src, {
        quality,
        fill: resolveFill(),
        onProgress: (label, ratio) => {
          setProgress(`${label} · ${Math.round(ratio * 100)}%`);
        },
      });
      setResult(out);
      setProgress(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Background removal failed. Try again on a clearer photo.",
      );
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setDoc(null);
    setPageIndex(0);
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read image"));
      reader.readAsDataURL(file);
    });
    setOriginal(dataUrl);
    await runOnSrc(dataUrl);
  };

  const onPickDoc = async (docs: DocumentRecord[]) => {
    const d = docs[0];
    if (!d?.pages.length) return;
    setDoc(d);
    setPageIndex(0);
    const src = d.pages[0].originalDataUrl ?? d.pages[0].imageDataUrl;
    setOriginal(src);
    await runOnSrc(src);
  };

  const reprocess = async () => {
    if (!original) return;
    await runOnSrc(original);
  };

  const saveIntoDocument = async () => {
    if (!result || !doc) return;
    setBusy(true);
    try {
      const pages = [...doc.pages];
      const page = pages[pageIndex];
      pages[pageIndex] = {
        ...page,
        originalDataUrl: page.originalDataUrl ?? page.imageDataUrl,
        imageDataUrl: result,
      };
      const updated = {
        ...doc,
        pages,
        thumbnail: pages[0]?.imageDataUrl,
        updatedAt: Date.now(),
      };
      await saveDocument(updated);
      setDoc(updated);
      startTransition(() => router.push(documentHref(doc.id)));
    } finally {
      setBusy(false);
    }
  };

  const saveAsNewDocument = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const now = Date.now();
      const record: DocumentRecord = {
        id: createId(),
        title: `Cutout ${new Date().toLocaleString()}`,
        createdAt: now,
        updatedAt: now,
        kind: "document",
        pages: [
          {
            id: createId(),
            imageDataUrl: result,
            originalDataUrl: original ?? result,
            filter: "original",
            createdAt: now,
          },
        ],
        thumbnail: result,
      };
      await saveDocument(record);
      startTransition(() => router.push(documentHref(record.id)));
    } finally {
      setBusy(false);
    }
  };

  const isTransparent =
    fillId === "transparent" && result?.startsWith("data:image/png");

  return (
    <main className="home">
      <AppHeader title="Remove Background" backHref="/tools" />
      <p className="hint" style={{ margin: "1rem 0" }}>
        AI cutout for portraits, products, and ID photos — runs on your device.
        First run downloads the model; later cuts are faster.
      </p>

      <div className="panel-stack rmbg-controls">
        <p className="subhead">Source</p>
        <div className="row-actions">
          <button
            type="button"
            className={`mini-chip ${sourceMode === "upload" ? "is-active" : ""}`}
            onClick={() => setSourceMode("upload")}
            disabled={busy}
          >
            Upload photo
          </button>
          <button
            type="button"
            className={`mini-chip ${sourceMode === "document" ? "is-active" : ""}`}
            onClick={() => setSourceMode("document")}
            disabled={busy}
          >
            From documents
          </button>
        </div>

        <p className="subhead">Quality</p>
        <div className="row-actions">
          {(
            [
              ["fast", "Fast"],
              ["balanced", "Balanced"],
              ["best", "Best"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`mini-chip ${quality === id ? "is-active" : ""}`}
              onClick={() => setQuality(id)}
              disabled={busy}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="subhead">Background</p>
        <div className="row-actions rmbg-fill-row">
          {BG_FILL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`mini-chip ${fillId === p.id ? "is-active" : ""}`}
              onClick={() => setFillId(p.id)}
              disabled={busy}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            className={`mini-chip ${fillId === "custom" ? "is-active" : ""}`}
            onClick={() => setFillId("custom")}
            disabled={busy}
          >
            Custom
          </button>
          {fillId === "custom" && (
            <label className="rmbg-color-pick" title="Custom background">
              <input
                type="color"
                value={customColor}
                disabled={busy}
                onChange={(e) => setCustomColor(e.target.value)}
              />
            </label>
          )}
        </div>
      </div>

      {!original && sourceMode === "upload" && (
        <div className="panel-stack" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
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
        </div>
      )}

      {!original && sourceMode === "document" && (
        <div style={{ marginTop: "1rem" }}>
          <DocPicker onSelect={(d) => void onPickDoc(d)} />
        </div>
      )}

      {original && (
        <div className="panel-stack rmbg-result" style={{ marginTop: "1rem" }}>
          {doc && (
            <p>
              <strong>{doc.title}</strong>
              {doc.pages.length > 1 ? ` · page ${pageIndex + 1}` : ""}
            </p>
          )}

          {doc && doc.pages.length > 1 && (
            <div className="page-strip compact">
              {doc.pages.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={`page-thumb-btn ${i === pageIndex ? "is-active" : ""}`}
                  disabled={busy}
                  onClick={() => {
                    setPageIndex(i);
                    const src = p.originalDataUrl ?? p.imageDataUrl;
                    setOriginal(src);
                    setResult(null);
                    void runOnSrc(src);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageDataUrl} alt={`Page ${i + 1}`} />
                </button>
              ))}
            </div>
          )}

          <div className="rmbg-compare">
            <figure>
              <figcaption>Original</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={original} alt="Original" />
            </figure>
            <figure>
              <figcaption>Result</figcaption>
              <div
                className={`rmbg-preview ${isTransparent ? "is-checker" : ""}`}
              >
                {result ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result} alt="Background removed" />
                ) : (
                  <div className="rmbg-preview-empty">
                    {busy ? "Processing…" : "No result yet"}
                  </div>
                )}
              </div>
            </figure>
          </div>

          <div className="row-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !original}
              onClick={() => void reprocess()}
            >
              Re-run
            </button>
            {result && (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() =>
                  downloadDataUrl(
                    result,
                    `cutout.${extensionForDataUrl(result)}`,
                  )
                }
              >
                Download
              </button>
            )}
            {result && doc && (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void saveIntoDocument()}
              >
                Save to document
              </button>
            )}
            {result && !doc && (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void saveAsNewDocument()}
              >
                Save as document
              </button>
            )}
            <button
              type="button"
              className="text-btn"
              disabled={busy}
              onClick={() => {
                setOriginal(null);
                setResult(null);
                setDoc(null);
                setError(null);
                setProgress(null);
              }}
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {(busy || progress || error) && (
        <p className={`busy-bar ${error ? "is-error" : ""}`} aria-live="polite">
          {error ?? (busy ? progress || "Working…" : progress)}
        </p>
      )}
    </main>
  );
}

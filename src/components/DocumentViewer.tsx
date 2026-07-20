"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "./AppHeader";
import type { DocumentRecord, ScanPage } from "@/lib/types";
import { deleteDocument, getDocument, saveDocument } from "@/lib/storage";
import { downloadBlob, exportDocumentPreferOriginal, printDocumentPages } from "@/lib/pdf";
import { extractTextFromImages } from "@/lib/ocr";
import { rebuildDocumentText } from "@/lib/editOperations";
import { hashPassword } from "@/lib/toolsOps";
import { documentHref } from "@/lib/routes";
import { createId } from "@/lib/id";
import {
  looksLikePdfPlaceholder,
  pdfBase64ToImageDataUrls,
} from "@/lib/pdfConvert";
import { ShareSheet } from "./ShareSheet";
import { CnicPrintSheet } from "./CnicPrintSheet";
import { WatermarkSheet } from "./WatermarkSheet";
import { WatermarkOverlay } from "./WatermarkOverlay";
import type { WatermarkOptions } from "@/lib/types";
import {
  resolveDocWatermark,
  stampWatermarkOnImage,
  watermarkLabel,
} from "@/lib/watermark";

type Props = { id: string };

function withUpdate(
  doc: DocumentRecord,
  patch: Partial<DocumentRecord>,
): DocumentRecord {
  return { ...doc, ...patch, updatedAt: Date.now() };
}

export function DocumentViewer({ id }: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentRecord | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [lockInput, setLockInput] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showOcr, setShowOcr] = useState(false);
  const [ocrDraft, setOcrDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [cnicPrintOpen, setCnicPrintOpen] = useState(false);
  const [watermarkOpen, setWatermarkOpen] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [pageZoom, setPageZoom] = useState(1);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [watermarkDraft, setWatermarkDraft] = useState<WatermarkOptions | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const rerenderedRef = useRef<string | null>(null);
  const pageImageRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(
    null,
  );

  /** 50%–800% so users can zoom out (fit more vertically) and in */
  const clampPageZoom = (z: number) => Math.min(8, Math.max(0.5, z));

  const pinchDistance = (a: React.Touch, b: React.Touch) =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  // Close text panel immediately whenever this document is opened / switched
  useEffect(() => {
    setShowOcr(false);
    setOcrDraft("");
    setOcrRunning(false);
    setOcrProgress(0);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void getDocument(id).then((d) => {
      if (cancelled) return;
      setDoc(d ?? null);
      // Saved OCR stays on the document for "View text" — panel stays closed
      if (d?.ocrText) {
        setOcrDraft(d.ocrText);
      }
      setShowOcr(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const reloadPdfPages = async (target?: DocumentRecord) => {
    const current = target ?? doc;
    if (!current?.sourcePdfBase64) {
      alert("No source PDF stored for this document. Re-import the file.");
      return;
    }
    setBusy(true);
    setRenderStatus("Rendering PDF pages…");
    try {
      const images = await pdfBase64ToImageDataUrls(current.sourcePdfBase64);
      const now = Date.now();
      const pages: ScanPage[] = images.map((imageDataUrl, i) => ({
        id: createId(),
        imageDataUrl,
        originalDataUrl: imageDataUrl,
        filter: "original" as const,
        createdAt: now + i,
      }));
      const updated = withUpdate(current, {
        pages,
        thumbnail: pages[0]?.imageDataUrl,
        kind: current.kind === "pdf_form" ? "pdf_form" : "document",
      });
      await saveDocument(updated);
      setDoc(updated);
      setActive(0);
      setRenderStatus(`Loaded ${pages.length} page(s)`);
    } catch (e) {
      setRenderStatus(e instanceof Error ? e.message : "Failed to render PDF");
      alert(e instanceof Error ? e.message : "Failed to render PDF pages");
    } finally {
      setBusy(false);
    }
  };

  // Auto-fix old blank "Imported PDF form" placeholders when source PDF exists
  useEffect(() => {
    if (!doc?.sourcePdfBase64) return;
    if (rerenderedRef.current === doc.id) return;
    const needs =
      doc.pages.some((p) => p.id === "imported") ||
      doc.pages.some((p) => looksLikePdfPlaceholder(p.imageDataUrl));
    if (!needs) return;
    rerenderedRef.current = doc.id;
    const handle = window.setTimeout(() => {
      void reloadPdfPages(doc);
    }, 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, doc?.sourcePdfBase64]);

  useEffect(() => {
    setPageZoom(1);
  }, [active, doc?.pages[active]?.id]);

  // Bake watermark into the on-screen preview (matches export look & feel)
  useEffect(() => {
    if (!doc) return;
    const src = doc.pages[active]?.imageDataUrl;
    if (!src) {
      setPreviewSrc(null);
      return;
    }
    const wm = watermarkDraft ?? resolveDocWatermark(doc);
    if (!wm) {
      setPreviewSrc(src);
      return;
    }

    let cancelled = false;
    setPreviewSrc(src);
    setRenderStatus("Applying watermark preview…");
    void stampWatermarkOnImage(src, wm)
      .then((stamped) => {
        if (cancelled) return;
        setPreviewSrc(stamped);
        setRenderStatus(null);
      })
      .catch(() => {
        if (cancelled) return;
        // Keep original + CSS overlay fallback
        setPreviewSrc(src);
        setRenderStatus(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    active,
    doc,
    watermarkDraft,
    doc?.pages[active]?.imageDataUrl,
    doc?.watermark,
    doc?.watermarkOptions?.text,
    doc?.watermarkOptions?.color,
    doc?.watermarkOptions?.opacity,
    doc?.watermarkOptions?.layout,
    doc?.watermarkOptions?.angle,
    doc?.watermarkOptions?.size,
    doc?.watermarkOptions?.spacing,
  ]);

  if (doc === undefined) {
    return <div className="center-pad muted">Loading…</div>;
  }

  if (!doc) {
    return (
      <div className="center-pad">
        <p className="muted">Document not found.</p>
        <Link href="/" className="btn-primary">
          Back to library
        </Link>
      </div>
    );
  }

  if (doc.locked && doc.lockHash && !unlocked) {
    return (
      <div className="center-pad">
        <p className="empty-kicker">Locked</p>
        <p className="muted">{doc.title}</p>
        <label className="field" style={{ maxWidth: 280, width: "100%" }}>
          <span>Password</span>
          <input
            type="password"
            value={lockInput}
            onChange={(e) => setLockInput(e.target.value)}
          />
        </label>
        {lockError && <p className="hint">{lockError}</p>}
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            void (async () => {
              const h = await hashPassword(lockInput);
              if (h === doc.lockHash) {
                setUnlocked(true);
                setLockError(null);
              } else setLockError("Wrong password");
            })()
          }
        >
          Unlock
        </button>
        <Link href="/" className="text-btn">
          Back
        </Link>
      </div>
    );
  }

  const isId = doc.kind === "id_card";
  const front =
    doc.pages.find((p) => p.side === "front") ?? doc.pages[0] ?? null;
  const back = doc.pages.find((p) => p.side === "back") ?? null;
  const activePage = doc.pages[active];
  const pageWatermark = resolveDocWatermark(doc);
  const visibleWatermark = watermarkDraft ?? pageWatermark;

  const persist = async (updated: DocumentRecord) => {
    await saveDocument(updated);
    setDoc(updated);
  };

  const rename = async () => {
    const title = prompt("Document title", doc.title);
    if (!title?.trim()) return;
    await persist(withUpdate(doc, { title: title.trim() }));
  };

  const setWatermark = async (options: WatermarkOptions | null) => {
    const next = withUpdate(doc, {});
    if (options) {
      next.watermark = options.text;
      next.watermarkOptions = options;
    } else {
      delete next.watermark;
      delete next.watermarkOptions;
    }
    await persist(next);
    setRenderStatus(
      options
        ? "Watermark on page — check look & feel"
        : "Watermark cleared",
    );
    window.setTimeout(() => setRenderStatus(null), 2200);
  };

  const exportPdf = async (a4 = false) => {
    if (isId) {
      setCnicPrintOpen(true);
      return;
    }
    setBusy(true);
    try {
      const blob = await exportDocumentPreferOriginal(doc, {
        watermark: resolveDocWatermark(doc) ?? doc.watermark,
        a4,
      });
      if (blob.size < 500) throw new Error("PDF export produced an empty file");
      downloadBlob(
        blob,
        `${doc.title.replace(/\s+/g, "-").toLowerCase()}.pdf`,
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setBusy(false);
    }
  };

  const doPrint = async () => {
    if (isId) {
      setCnicPrintOpen(true);
      return;
    }
    setBusy(true);
    try {
      await printDocumentPages(
        doc.pages.map((p) => p.imageDataUrl),
        doc.title,
        { watermark: pageWatermark },
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Print failed");
    } finally {
      setBusy(false);
    }
  };

  const runOcr = async () => {
    // Already extracted — just show it again (don't re-run until asked)
    if (doc.ocrText?.trim() && !showOcr) {
      setOcrDraft(doc.ocrText);
      setShowOcr(true);
      setRenderStatus("Showing extracted text");
      window.setTimeout(() => setRenderStatus(null), 1600);
      return;
    }

    // Panel open with existing text — confirm before replacing
    if (doc.ocrText?.trim() && showOcr) {
      if (!confirm("Extract text again? This replaces the current text.")) {
        return;
      }
    }

    setOcrRunning(true);
    setOcrProgress(0);
    setRenderStatus("Extracting text…");
    try {
      const text = await extractTextFromImages(
        doc.pages.map((p) => p.imageDataUrl),
        setOcrProgress,
      );
      const updated = withUpdate(doc, { ocrText: text });
      await persist(updated);
      setOcrDraft(text);
      setShowOcr(true);
      setRenderStatus(
        text.trim() ? "Text extracted" : "No text found on these pages",
      );
      window.setTimeout(() => setRenderStatus(null), 2000);
    } finally {
      setOcrRunning(false);
    }
  };

  const saveOcrText = async () => {
    const pages = doc.pages.map((p, i) =>
      i === active ? { ...p, ocrText: ocrDraft } : p,
    );
    await persist(
      withUpdate(doc, {
        pages,
        ocrText: ocrDraft.includes("— Page")
          ? ocrDraft
          : rebuildDocumentText(
              doc.pages.map((p, i) => (i === active ? ocrDraft : p.ocrText)),
            ) || ocrDraft,
      }),
    );
  };

  const copyText = async () => {
    const text = ocrDraft || doc.ocrText || "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const movePage = async (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= doc.pages.length) return;
    const pages = [...doc.pages];
    const [item] = pages.splice(from, 1);
    pages.splice(to, 0, item);
    await persist(
      withUpdate(doc, {
        pages,
        thumbnail: pages[0]?.imageDataUrl,
      }),
    );
    setActive(to);
  };

  const deletePage = async (index: number) => {
    if (doc.pages.length <= 1) {
      alert("A document needs at least one page.");
      return;
    }
    if (!confirm("Delete this page?")) return;
    const pages = doc.pages.filter((_, i) => i !== index);
    await persist(
      withUpdate(doc, {
        pages,
        thumbnail: pages[0]?.imageDataUrl,
      }),
    );
    setActive(Math.min(index, pages.length - 1));
  };

  const remove = async () => {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(doc.id);
    startTransition(() => router.push("/"));
  };

  return (
    <div className="doc-view">
      <AppHeader
        title={doc.title}
        backHref="/"
        action={
          <button type="button" className="text-btn" onClick={() => void rename()}>
            Rename
          </button>
        }
      />

      {isId && (
        <div className="id-banner soft">
          Pakistani CNIC · 85.6 × 53.98 mm · Front
          {back ? " + Back" : ""} ready
        </div>
      )}

      <div className="doc-scroll">
        <div className="crop-zoom-bar doc-zoom-bar" role="toolbar" aria-label="Page zoom">
          <button
            type="button"
            className="cs-zoom-btn"
            disabled={pageZoom <= 0.5}
            onClick={() => setPageZoom((z) => clampPageZoom(z - 0.25))}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="cs-zoom-pct"
            onClick={() => setPageZoom(1)}
            aria-label="Reset zoom to 100%"
          >
            {Math.round(pageZoom * 100)}%
          </button>
          <button
            type="button"
            className="cs-zoom-btn"
            disabled={pageZoom >= 8}
            onClick={() => setPageZoom((z) => clampPageZoom(z + 0.25))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="mini-chip"
            onClick={() => {
              // Fit full page height into the stage (vertical zoom)
              const stage = stageRef.current;
              const img = pageImageRef.current;
              if (!stage || !img?.naturalWidth) {
                setPageZoom(0.75);
                return;
              }
              const stageW = Math.max(1, stage.clientWidth - 24);
              const stageH = Math.max(1, stage.clientHeight - 8);
              const heightAt100 =
                (img.naturalHeight / img.naturalWidth) * stageW;
              const z = stageH / Math.max(1, heightAt100);
              setPageZoom(clampPageZoom(Math.min(Math.max(z, 0.5), 1)));
              stage.scrollTop = 0;
              stage.scrollLeft = 0;
            }}
            aria-label="Fit page height"
            title="Fit vertical"
          >
            Fit V
          </button>
          <span className="cs-zoom-hint">
            Pinch · scroll to check watermark
          </span>
        </div>
        <div
          ref={stageRef}
          className={`doc-stage ${pageZoom !== 1 ? "is-zoomed" : ""}`}
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              pinchRef.current = {
                startDist: pinchDistance(e.touches[0], e.touches[1]),
                startZoom: pageZoom,
              };
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2 && pinchRef.current) {
              e.preventDefault();
              const dist = pinchDistance(e.touches[0], e.touches[1]);
              const ratio = dist / Math.max(1, pinchRef.current.startDist);
              setPageZoom(
                clampPageZoom(pinchRef.current.startZoom * ratio),
              );
            }
          }}
          onTouchEnd={() => {
            pinchRef.current = null;
          }}
          onTouchCancel={() => {
            pinchRef.current = null;
          }}
        >
          <div
            className="doc-page-frame"
            style={{
              width: `${Math.round(pageZoom * 100)}%`,
              maxWidth: pageZoom <= 1 ? "100%" : "none",
              maxHeight: "none",
              height: "auto",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={pageImageRef}
              src={previewSrc ?? activePage?.imageDataUrl}
              alt={`Page ${active + 1}`}
              className="doc-page-image"
              style={{
                width: "100%",
                height: "auto",
                maxWidth: "none",
                maxHeight: "none",
                display: "block",
              }}
            />
            {/* CSS overlay while baking, or if bake failed — always show when watermark on */}
            {visibleWatermark &&
              (!previewSrc ||
                previewSrc === activePage?.imageDataUrl) && (
                <WatermarkOverlay options={visibleWatermark} />
              )}
          </div>
        </div>

        {(busy || renderStatus) && (
          <p className="busy-bar" aria-live="polite">
            {busy ? renderStatus || "Working…" : renderStatus}
          </p>
        )}

        {doc.sourcePdfBase64 && (
          <p className="hint" style={{ textAlign: "center", margin: "0.5rem 0 0" }}>
            Imported from PDF — use <strong>Reload PDF pages</strong> if the
            preview looks blank.
          </p>
        )}

        {doc.pages.length > 1 && (
          <div className="page-strip compact">
            {doc.pages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`page-thumb-btn ${i === active ? "is-active" : ""}`}
                onClick={() => {
                  setActive(i);
                  setOcrDraft(p.ocrText || doc.ocrText || "");
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageDataUrl}
                  alt={p.side ?? `Page ${i + 1}`}
                />
              </button>
            ))}
          </div>
        )}

        {manage && (
          <section className="manage-panel">
            <h2>Manage pages</h2>
            <ul className="manage-list">
              {doc.pages.map((p, i) => (
                <li key={p.id}>
                  <span>
                    {p.side
                      ? p.side === "front"
                        ? "Front"
                        : "Back"
                      : `Page ${i + 1}`}
                  </span>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="text-btn"
                      disabled={i === 0}
                      onClick={() => void movePage(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="text-btn"
                      disabled={i === doc.pages.length - 1}
                      onClick={() => void movePage(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => void deletePage(i)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* OCR opens only after Extract text / View text — not on document load */}
      </div>

      <div className="doc-toolbar">
        <Link
          href={documentHref(doc.id, "edit", activePage?.id ?? "")}
          className="btn-primary"
        >
          Edit page
        </Link>
        <Link
          href={
            doc.kind === "pdf_form" && doc.sourcePdfBase64
              ? documentHref(doc.id, "pdf-form")
              : documentHref(doc.id, "form")
          }
          className="btn-secondary"
        >
          Form fill
        </Link>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void doPrint()}
          disabled={busy}
        >
          {isId ? "Print / Export" : "Print"}
        </button>
        {!isId && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void exportPdf(true)}
            disabled={busy}
          >
            Export PDF
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShareOpen(true)}
          disabled={busy}
        >
          Share
        </button>
        {doc.pages.length >= 2 && (
          <Link
            href={`/tools/collage?id=${encodeURIComponent(doc.id)}`}
            className="btn-secondary"
          >
            Collage
          </Link>
        )}
        {doc.sourcePdfBase64 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void reloadPdfPages()}
            disabled={busy}
          >
            Reload PDF pages
          </button>
        )}
        <Link
          href={`/scan?append=${doc.id}${isId ? "&mode=id_card" : ""}`}
          className="btn-secondary"
        >
          {isId ? "Rescan side" : "Add page"}
        </Link>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setManage((v) => !v)}
        >
          Pages
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setWatermarkOpen(true)}
        >
          {watermarkLabel(visibleWatermark)}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void runOcr()}
          disabled={ocrRunning}
        >
          {ocrRunning
            ? `OCR ${ocrProgress}%`
            : doc.ocrText?.trim()
              ? showOcr
                ? "Extract again"
                : "View text"
              : "Extract text"}
        </button>
        <button type="button" className="btn-danger" onClick={() => void remove()}>
          Delete
        </button>
      </div>

      {showOcr && (
        <div
          className="ocr-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Document text"
          onClick={() => setShowOcr(false)}
        >
          <section
            className="ocr-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ocr-head">
              <h2>Document text</h2>
              <div className="row-actions">
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => void copyText()}
                  disabled={!ocrDraft.trim()}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setShowOcr(false)}
                >
                  Done
                </button>
              </div>
            </div>
            <textarea
              className="ocr-text"
              value={ocrDraft}
              onChange={(e) => setOcrDraft(e.target.value)}
              rows={12}
              placeholder="Extracted text appears here."
            />
            <div className="row-actions" style={{ marginTop: "0.65rem" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void saveOcrText()}
                disabled={!ocrDraft.trim()}
              >
                Save edits
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void runOcr()}
                disabled={ocrRunning}
              >
                {ocrRunning ? `OCR ${ocrProgress}%` : "Extract again"}
              </button>
            </div>
          </section>
        </div>
      )}

      <ShareSheet
        doc={doc}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onStatus={(msg) => {
          setRenderStatus(msg);
          if (msg) {
            window.setTimeout(() => setRenderStatus(null), 2500);
          }
        }}
      />

      <WatermarkSheet
        doc={doc}
        open={watermarkOpen}
        onClose={() => {
          setWatermarkOpen(false);
          setWatermarkDraft(null);
        }}
        onSave={setWatermark}
        onDraftChange={setWatermarkDraft}
      />

      {isId && (
        <CnicPrintSheet
          doc={doc}
          open={cnicPrintOpen}
          onClose={() => setCnicPrintOpen(false)}
          onStatus={(msg) => {
            setRenderStatus(msg);
            if (msg) {
              window.setTimeout(() => setRenderStatus(null), 2800);
            }
          }}
        />
      )}
    </div>
  );
}

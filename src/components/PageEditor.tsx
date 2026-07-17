"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "./AppHeader";
import type {
  DocumentRecord,
  EditorTool,
  EnhanceAdjustments,
  OcrWord,
  ScanFilter,
  ScanPage,
} from "@/lib/types";
import { SCAN_FILTERS } from "@/lib/types";
import { getDocument, saveDocument } from "@/lib/storage";
import { applyFilter, loadImage } from "@/lib/imageProcessing";
import { recognizePage } from "@/lib/ocr";
import {
  applyEnhanceAdjustments,
  drawAnnotationStroke,
  drawFreeText,
  eraseAtPoints,
  eraseRegion,
  findReplaceOnImage,
  rebuildDocumentText,
  replaceWordOnImage,
  rotateImage,
} from "@/lib/editOperations";

type Props = {
  documentId: string;
  pageId?: string;
};

export function PageEditor({ documentId, pageId }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState<EditorTool>("enhance");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(28);
  const [drawing, setDrawing] = useState(false);
  const [adjust, setAdjust] = useState<EnhanceAdjustments>({
    brightness: 0,
    contrast: 0,
    sharpness: 0,
  });
  const [words, setWords] = useState<OcrWord[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [addText, setAddText] = useState("");
  const [addFontSize, setAddFontSize] = useState(28);
  const [placeMode, setPlaceMode] = useState(false);
  const [scale, setScale] = useState(1);
  const [inkColor, setInkColor] = useState("#e11d48");
  const [inkWidth, setInkWidth] = useState(4);
  const [docTextDraft, setDocTextDraft] = useState("");
  const strokePoints = useRef<{ x: number; y: number }[]>([]);
  const baseImageRef = useRef<string | null>(null);

  const page = doc?.pages[pageIndex];

  useEffect(() => {
    let cancelled = false;
    void getDocument(documentId).then((d) => {
      if (cancelled || !d) {
        if (!cancelled) setDoc(null);
        return;
      }
      setDoc(d);
      const idx = pageId
        ? Math.max(
            0,
            d.pages.findIndex((p) => p.id === pageId),
          )
        : 0;
      setPageIndex(idx === -1 ? 0 : idx);
      const p = d.pages[idx === -1 ? 0 : idx];
      if (p) {
        setWords(p.ocrWords ?? []);
        setDocTextDraft(p.ocrText ?? "");
        baseImageRef.current = p.originalDataUrl ?? p.imageDataUrl;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [documentId, pageId]);

  const paintCanvas = useCallback(async (src: string, overlayWords?: OcrWord[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = await loadImage(src);
    const maxW = Math.min(window.innerWidth - 24, 900);
    const maxH = Math.min(window.innerHeight * 0.48, 560);
    const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    setScale(s);
    canvas.width = Math.round(img.naturalWidth * s);
    canvas.height = Math.round(img.naturalHeight * s);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const list = overlayWords ?? words;
    if (tool === "text" && list.length) {
      for (const w of list) {
        const active = w.id === selectedWordId;
        ctx.strokeStyle = active ? "#0f766e" : "rgba(45, 212, 191, 0.7)";
        ctx.lineWidth = active ? 2.5 : 1.5;
        ctx.fillStyle = active
          ? "rgba(15, 118, 110, 0.18)"
          : "rgba(45, 212, 191, 0.08)";
        const x = w.bbox.x0 * s;
        const y = w.bbox.y0 * s;
        const ww = (w.bbox.x1 - w.bbox.x0) * s;
        const hh = (w.bbox.y1 - w.bbox.y0) * s;
        ctx.fillRect(x, y, ww, hh);
        ctx.strokeRect(x, y, ww, hh);
      }
    }
  }, [selectedWordId, tool, words]);

  useEffect(() => {
    if (!page) return;
    void paintCanvas(page.imageDataUrl);
  }, [page, paintCanvas, tool]);

  const persistPage = async (
    nextImage: string,
    patch: Partial<ScanPage> = {},
  ) => {
    if (!doc || !page) return;
    const pages = doc.pages.map((p, i) =>
      i === pageIndex
        ? {
            ...p,
            originalDataUrl: p.originalDataUrl ?? p.imageDataUrl,
            imageDataUrl: nextImage,
            ...patch,
          }
        : p,
    );
    const updated: DocumentRecord = {
      ...doc,
      pages,
      thumbnail: pages[0]?.imageDataUrl,
      updatedAt: Date.now(),
      ocrText: rebuildDocumentText(pages.map((p) => p.ocrText)),
    };
    await saveDocument(updated);
    setDoc(updated);
    await paintCanvas(nextImage, patch.ocrWords ?? words);
  };

  const pointerToImage = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * (canvas.width / scale);
    const y = ((e.clientY - rect.top) / rect.height) * (canvas.height / scale);
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!page) return;
    const pt = pointerToImage(e);

    if (tool === "text" && placeMode && addText.trim()) {
      void (async () => {
        setBusy(true);
        try {
          const next = await drawFreeText(
            page.imageDataUrl,
            addText,
            pt.x,
            pt.y,
            addFontSize / scale,
          );
          setPlaceMode(false);
          await persistPage(next);
          setStatus("Text added to page");
        } finally {
          setBusy(false);
        }
      })();
      return;
    }

    if (tool === "text") {
      const hit = words.find(
        (w) =>
          pt.x >= w.bbox.x0 &&
          pt.x <= w.bbox.x1 &&
          pt.y >= w.bbox.y0 &&
          pt.y <= w.bbox.y1,
      );
      if (hit) {
        setSelectedWordId(hit.id);
        setEditText(hit.text);
      }
      return;
    }

    if (tool !== "erase" && tool !== "annotate") return;
    setDrawing(true);
    strokePoints.current = [pt];
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing || (tool !== "erase" && tool !== "annotate")) return;
    strokePoints.current.push(pointerToImage(e));
    // Live preview
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !page) return;
    void loadImage(page.imageDataUrl).then((img) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (tool === "erase") {
        ctx.fillStyle = "rgba(243, 248, 250, 0.85)";
        ctx.strokeStyle = "#0f766e";
        ctx.lineWidth = 1.5;
        for (const p of strokePoints.current) {
          ctx.beginPath();
          ctx.arc(p.x * scale, p.y * scale, brushSize * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = inkWidth * scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        const pts = strokePoints.current;
        ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * scale, pts[i].y * scale);
        }
        ctx.stroke();
      }
    });
  };

  const onPointerUp = () => {
    if (!drawing || !page) return;
    setDrawing(false);
    const points = strokePoints.current;
    strokePoints.current = [];
    if (points.length === 0) return;
    void (async () => {
      setBusy(true);
      try {
        if (tool === "erase") {
          const next = await eraseAtPoints(page.imageDataUrl, points, brushSize);
          await persistPage(next);
          setStatus("Erased marks");
        } else if (tool === "annotate" && points.length > 1) {
          const next = await drawAnnotationStroke(
            page.imageDataUrl,
            points,
            inkColor,
            inkWidth,
          );
          await persistPage(next);
          setStatus("Annotation added");
        }
      } finally {
        setBusy(false);
      }
    })();
  };

  const runOcr = async () => {
    if (!page) return;
    setBusy(true);
    setStatus("Scanning text…");
    setOcrProgress(0);
    try {
      const result = await recognizePage(page.imageDataUrl, setOcrProgress);
      setWords(result.words);
      setSelectedWordId(null);
      setDocTextDraft(result.text);
      await persistPage(page.imageDataUrl, {
        ocrText: result.text,
        ocrWords: result.words,
      });
      setTool("text");
      setStatus(
        result.words.length
          ? `Found ${result.words.length} words — tap one to edit`
          : "No text detected",
      );
    } finally {
      setBusy(false);
    }
  };

  const applyWordEdit = async () => {
    if (!page || !selectedWordId) return;
    const word = words.find((w) => w.id === selectedWordId);
    if (!word) return;
    setBusy(true);
    try {
      const next = await replaceWordOnImage(page.imageDataUrl, word, editText);
      const nextWords = words
        .filter((w) => w.id !== word.id)
        .concat(
          editText.trim()
            ? [{ ...word, text: editText.trim() }]
            : [],
        );
      setWords(nextWords);
      setSelectedWordId(editText.trim() ? word.id : null);
      await persistPage(next, {
        ocrWords: nextWords,
        ocrText: nextWords.map((w) => w.text).join(" "),
      });
      setStatus("Text updated on page");
    } finally {
      setBusy(false);
    }
  };

  const eraseSelectedWord = async () => {
    if (!page || !selectedWordId) return;
    const word = words.find((w) => w.id === selectedWordId);
    if (!word) return;
    setBusy(true);
    try {
      const next = await eraseRegion(page.imageDataUrl, word.bbox, 3);
      const nextWords = words.filter((w) => w.id !== word.id);
      setWords(nextWords);
      setSelectedWordId(null);
      setEditText("");
      await persistPage(next, {
        ocrWords: nextWords,
        ocrText: nextWords.map((w) => w.text).join(" "),
      });
      setStatus("Text erased");
    } finally {
      setBusy(false);
    }
  };

  const runFindReplace = async (all: boolean) => {
    if (!page || !findText.trim()) return;
    setBusy(true);
    try {
      const { image, changed, remainingWords } = await findReplaceOnImage(
        page.imageDataUrl,
        words,
        findText,
        replaceText,
        all,
      );
      setWords(remainingWords);
      await persistPage(image, {
        ocrWords: remainingWords,
        ocrText: remainingWords.map((w) => w.text).join(" "),
      });
      setStatus(
        changed ? `Replaced ${changed} match${changed === 1 ? "" : "es"}` : "No matches",
      );
    } finally {
      setBusy(false);
    }
  };

  const applyAdjustments = async () => {
    if (!page) return;
    setBusy(true);
    try {
      const next = await applyEnhanceAdjustments(page.imageDataUrl, adjust);
      await persistPage(next);
      setAdjust({ brightness: 0, contrast: 0, sharpness: 0 });
      setStatus("Photo enhanced");
    } finally {
      setBusy(false);
    }
  };

  const applyQuickFilter = async (filter: ScanFilter) => {
    if (!page) return;
    setBusy(true);
    try {
      const source = page.originalDataUrl ?? page.imageDataUrl;
      const next =
        filter === "original" ? source : await applyFilter(source, filter);
      await persistPage(next, { filter });
      setStatus(`${SCAN_FILTERS.find((f) => f.id === filter)?.label ?? "Filter"} applied`);
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (deg: 90 | 180 | 270) => {
    if (!page) return;
    setBusy(true);
    try {
      const next = await rotateImage(page.imageDataUrl, deg);
      setWords([]);
      await persistPage(next, { ocrWords: [], ocrText: "" });
      setStatus(`Rotated ${deg}°`);
    } finally {
      setBusy(false);
    }
  };

  const resetPage = async () => {
    if (!page) return;
    const original = page.originalDataUrl;
    if (!original) {
      setStatus("Nothing to reset");
      return;
    }
    setBusy(true);
    try {
      setWords([]);
      setAdjust({ brightness: 0, contrast: 0, sharpness: 0 });
      await persistPage(original, {
        ocrWords: [],
        ocrText: "",
        filter: "original",
      });
      setStatus("Page reset to original scan");
    } finally {
      setBusy(false);
    }
  };

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

  if (!page) {
    return (
      <div className="center-pad">
        <p className="muted">No pages in this document.</p>
        <Link href={`/document/${doc.id}`} className="btn-primary">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="page-editor">
      <AppHeader
        title="Edit page"
        backHref={`/document/${doc.id}`}
        action={
          <button
            type="button"
            className="text-btn"
            onClick={() => router.push(`/document/${doc.id}`)}
          >
            Done
          </button>
        }
      />

      {(busy || status) && (
        <div className="busy-bar" aria-live="polite">
          {busy ? "Working…" : status}
          {busy && ocrProgress > 0 && tool === "text" ? ` ${ocrProgress}%` : ""}
        </div>
      )}

      <div className="editor-canvas-wrap">
        <canvas
          ref={canvasRef}
          className={`editor-canvas tool-${tool} ${placeMode ? "place-mode" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      {doc.pages.length > 1 && (
        <div className="page-strip compact">
          {doc.pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`page-thumb-btn ${i === pageIndex ? "is-active" : ""}`}
              onClick={() => {
                setPageIndex(i);
                setWords(p.ocrWords ?? []);
                setSelectedWordId(null);
                setDocTextDraft(p.ocrText ?? "");
                baseImageRef.current = p.originalDataUrl ?? p.imageDataUrl;
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageDataUrl} alt={`Page ${i + 1}`} />
            </button>
          ))}
        </div>
      )}

      <nav className="editor-tools" aria-label="Edit tools">
        {(
          [
            ["enhance", "Enhance"],
            ["erase", "Erase"],
            ["text", "Text"],
            ["annotate", "Mark"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tool-tab ${tool === id ? "is-active" : ""}`}
            onClick={() => {
              setTool(id);
              setPlaceMode(false);
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="editor-panel">
        {tool === "enhance" && (
          <div className="panel-stack">
            <p className="panel-title">Enhance photo</p>
            <div className="filter-row tight">
{SCAN_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`mini-chip ${page.filter === f.id ? "is-active" : ""}`}
                    onClick={() => void applyQuickFilter(f.id)}
                    disabled={busy}
                  >
                    {f.label}
                  </button>
                ))}
            </div>
            <label className="slider-row">
              <span>Brightness</span>
              <input
                type="range"
                min={-50}
                max={50}
                value={adjust.brightness}
                onChange={(e) =>
                  setAdjust((a) => ({
                    ...a,
                    brightness: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="slider-row">
              <span>Contrast</span>
              <input
                type="range"
                min={-50}
                max={50}
                value={adjust.contrast}
                onChange={(e) =>
                  setAdjust((a) => ({
                    ...a,
                    contrast: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="slider-row">
              <span>Sharpen</span>
              <input
                type="range"
                min={0}
                max={100}
                value={adjust.sharpness}
                onChange={(e) =>
                  setAdjust((a) => ({
                    ...a,
                    sharpness: Number(e.target.value),
                  }))
                }
              />
            </label>
            <div className="step-actions stacked">
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void applyAdjustments()}
              >
                Apply enhancement
              </button>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void rotate(90)}
                >
                  Rotate 90°
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void resetPage()}
                >
                  Reset page
                </button>
              </div>
            </div>
          </div>
        )}

        {tool === "erase" && (
          <div className="panel-stack">
            <p className="panel-title">Erase marks</p>
            <p className="hint">
              Drag over stains, fingerprints, or unwanted writing. Eraser matches
              nearby paper color.
            </p>
            <label className="slider-row">
              <span>Brush {brushSize}px</span>
              <input
                type="range"
                min={8}
                max={80}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
              />
            </label>
          </div>
        )}

        {tool === "text" && (
          <div className="panel-stack">
            <p className="panel-title">Text operations</p>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void runOcr()}
            >
              {words.length ? "Re-scan text (OCR)" : "Detect text (OCR)"}
            </button>

            {selectedWordId && (
              <div className="text-edit-box">
                <label className="field">
                  <span>Selected word</span>
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="New text"
                  />
                </label>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => void applyWordEdit()}
                  >
                    Replace on page
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy}
                    onClick={() => void eraseSelectedWord()}
                  >
                    Erase text
                  </button>
                </div>
              </div>
            )}

            <div className="text-edit-box">
              <p className="subhead">Find & replace</p>
              <label className="field">
                <span>Find</span>
                <input
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="Exact word"
                />
              </label>
              <label className="field">
                <span>Replace with</span>
                <input
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="Leave blank to erase"
                />
              </label>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy || !findText.trim() || !words.length}
                  onClick={() => void runFindReplace(false)}
                >
                  Replace one
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy || !findText.trim() || !words.length}
                  onClick={() => void runFindReplace(true)}
                >
                  Replace all
                </button>
              </div>
            </div>

            <div className="text-edit-box">
              <p className="subhead">Add text</p>
              <label className="field">
                <span>Content</span>
                <input
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  placeholder="Type text to place"
                />
              </label>
              <label className="slider-row">
                <span>Size {addFontSize}</span>
                <input
                  type="range"
                  min={12}
                  max={72}
                  value={addFontSize}
                  onChange={(e) => setAddFontSize(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                className={`btn-secondary ${placeMode ? "is-active-btn" : ""}`}
                disabled={!addText.trim() || busy}
                onClick={() => setPlaceMode((v) => !v)}
              >
                {placeMode ? "Tap page to place…" : "Place on page"}
              </button>
            </div>

            {page.ocrText !== undefined && (
              <label className="field">
                <span>Editable extracted text</span>
                <textarea
                  className="ocr-text"
                  rows={6}
                  value={docTextDraft}
                  onChange={(e) => setDocTextDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    void persistPage(page.imageDataUrl, {
                      ocrText: docTextDraft,
                    })
                  }
                >
                  Save text
                </button>
              </label>
            )}
          </div>
        )}

        {tool === "annotate" && (
          <div className="panel-stack">
            <p className="panel-title">Mark / annotate</p>
            <p className="hint">Draw highlights or marks on the scan.</p>
            <div className="row-actions">
              {["#e11d48", "#2563eb", "#ca8a04", "#0f766e", "#111111"].map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch ${inkColor === c ? "is-active" : ""}`}
                    style={{ background: c }}
                    aria-label={`Ink ${c}`}
                    onClick={() => setInkColor(c)}
                  />
                ),
              )}
            </div>
            <label className="slider-row">
              <span>Stroke {inkWidth}px</span>
              <input
                type="range"
                min={2}
                max={24}
                value={inkWidth}
                onChange={(e) => setInkWidth(Number(e.target.value))}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

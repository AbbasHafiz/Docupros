"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CameraCapture } from "./CameraCapture";
import { CropEditor } from "./CropEditor";
import { FilterPicker } from "./FilterPicker";
import { AppHeader } from "./AppHeader";
import { createId } from "@/lib/id";
import {
  applyFilter,
  defaultIdQuad,
  defaultQuad,
  detectDocumentQuad,
  loadImage,
  warpPerspective,
} from "@/lib/imageProcessing";
import { rotateImage } from "@/lib/editOperations";
import { saveDocument, getDocument } from "@/lib/storage";
import { stampTimestamp } from "@/lib/toolsOps";
import { normalizeToCnicAspect } from "@/lib/cnic";
import { documentHref } from "@/lib/routes";
import {
  SCAN_FILTERS,
  type DocumentRecord,
  type Quad,
  type ScanFilter,
  type ScanMode,
  type ScanPage,
} from "@/lib/types";

type Props = {
  appendToId?: string;
  mode?: ScanMode;
  retakePageId?: string;
};

export function ScanFlow({
  appendToId,
  mode = "document",
  retakePageId,
}: Props) {
  const router = useRouter();
  const isId = mode === "id_card";
  const defaultFilter: ScanFilter =
    mode === "whiteboard"
      ? "whiteboard"
      : mode === "slides"
        ? "vivid"
        : mode === "book"
          ? "magic"
          : "magic";
  const [step, setStep] = useState<"capture" | "crop" | "enhance" | "review">(
    "capture",
  );
  const [idSide, setIdSide] = useState<"front" | "back">("front");
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [cropped, setCropped] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScanFilter>(defaultFilter);
  const [previews, setPreviews] = useState<Partial<Record<ScanFilter, string>>>(
    {},
  );
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<DocumentRecord | null>(null);
  const [appendReady, setAppendReady] = useState(!appendToId);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!appendToId) return;
    let cancelled = false;
    void getDocument(appendToId).then((doc) => {
      if (cancelled) return;
      if (doc) {
        setExisting(doc);
        setPages(doc.pages);
      }
      setAppendReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [appendToId]);

  const beginWithImage = async (dataUrl: string, liveQuad?: Quad) => {
    if (appendToId && !appendReady) return;
    setBusy(true);
    setRawImage(dataUrl);
    try {
      const img = await loadImage(dataUrl);
      const fallback = isId
        ? defaultIdQuad(img.naturalWidth, img.naturalHeight)
        : defaultQuad(img.naturalWidth, img.naturalHeight);
      if (liveQuad && !isId) {
        setQuad(liveQuad);
      } else {
        const detected = await detectDocumentQuad(dataUrl);
        setQuad(detected ?? fallback);
      }
      setStep("crop");
    } finally {
      setBusy(false);
    }
  };

  const runAutoCrop = async (src?: string) => {
    const image = src ?? rawImage;
    if (!image) return;
    setBusy(true);
    try {
      const img = await loadImage(image);
      const detected = await detectDocumentQuad(image);
      const fallback = isId
        ? defaultIdQuad(img.naturalWidth, img.naturalHeight)
        : defaultQuad(img.naturalWidth, img.naturalHeight);
      setQuad(detected ?? fallback);
    } finally {
      setBusy(false);
    }
  };

  const rotateCapture = async (degrees: 90 | 270) => {
    if (!rawImage) return;
    setBusy(true);
    try {
      const rotated = await rotateImage(rawImage, degrees);
      setRawImage(rotated);
      const img = await loadImage(rotated);
      const detected = await detectDocumentQuad(rotated);
      const fallback = isId
        ? defaultIdQuad(img.naturalWidth, img.naturalHeight)
        : defaultQuad(img.naturalWidth, img.naturalHeight);
      setQuad(detected ?? fallback);
    } finally {
      setBusy(false);
    }
  };

  const useFullPage = async () => {
    if (!rawImage) return;
    const img = await loadImage(rawImage);
    setQuad(
      isId
        ? defaultIdQuad(img.naturalWidth, img.naturalHeight)
        : defaultQuad(img.naturalWidth, img.naturalHeight),
    );
  };

  const confirmCrop = async () => {
    if (!rawImage || !quad) return;
    setBusy(true);
    try {
      let warped = await warpPerspective(rawImage, quad);
      if (isId) {
        warped = await normalizeToCnicAspect(warped);
      }
      setCropped(warped);
      const next: Partial<Record<ScanFilter, string>> = { original: warped };
      await Promise.all(
        SCAN_FILTERS.filter((f) => f.id !== "original").map(async (f) => {
          next[f.id] = await applyFilter(warped, f.id);
        }),
      );
      setPreviews(next);
      setFilter(defaultFilter);
      setStep("enhance");
    } finally {
      setBusy(false);
    }
  };

  const addCurrentPage = useCallback(async () => {
    if (!cropped) return;
    setBusy(true);
    try {
      let finalImage = await applyFilter(cropped, filter);
      if (mode === "timestamp") {
        finalImage = await stampTimestamp(finalImage);
      }
      const page: ScanPage = {
        id: retakePageId ?? createId(),
        imageDataUrl: finalImage,
        originalDataUrl: cropped,
        filter,
        createdAt: Date.now(),
        side: isId ? idSide : undefined,
      };

      setPages((prev) => {
        if (retakePageId) {
          const mapped = prev.map((p) =>
            p.id === retakePageId
              ? { ...page, side: p.side ?? page.side }
              : p,
          );
          // If retake id wasn't found (race), append instead of wiping
          if (!prev.some((p) => p.id === retakePageId)) {
            return [...prev, page];
          }
          return mapped;
        }
        if (!isId) return [...prev, page];
        const withoutSide = prev.filter((p) => p.side !== idSide);
        return [...withoutSide, page];
      });

      setRawImage(null);
      setQuad(null);
      setCropped(null);
      setPreviews({});

      if (retakePageId) {
        setStep("review");
        return;
      }

      if (isId) {
        if (idSide === "front") {
          setIdSide("back");
          setStep("capture");
        } else {
          setStep("review");
        }
      } else {
        setStep("review");
      }
    } finally {
      setBusy(false);
    }
  }, [cropped, filter, idSide, isId, mode, retakePageId]);

  const saveAll = async () => {
    if (pages.length === 0) return;
    if (appendToId && !appendReady) return;
    setBusy(true);
    try {
      const now = Date.now();
      const kind = isId || existing?.kind === "id_card" ? "id_card" : "document";
      if (existing || appendToId) {
        const base = existing;
        if (!base) {
          alert("Still loading document. Try again.");
          return;
        }
        const updated: DocumentRecord = {
          ...base,
          kind,
          pages,
          updatedAt: now,
          thumbnail: pages[0]?.imageDataUrl,
        };
        await saveDocument(updated);
        startTransition(() => router.push(documentHref(base.id)));
      } else {
        const id = createId();
        const doc: DocumentRecord = {
          id,
          title: isId
            ? `CNIC ${new Date(now).toLocaleString()}`
            : `Scan ${new Date(now).toLocaleString()}`,
          pages,
          kind,
          createdAt: now,
          updatedAt: now,
          thumbnail: pages[0]?.imageDataUrl,
        };
        await saveDocument(doc);
        startTransition(() => router.push(documentHref(id)));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed — storage may be full");
    } finally {
      setBusy(false);
    }
  };

  const front = pages.find((p) => p.side === "front") ?? pages[0];
  const back = pages.find((p) => p.side === "back");

  const title = isId
    ? step === "capture"
      ? idSide === "front"
        ? "CNIC Front"
        : "CNIC Back"
      : step === "crop"
        ? "Crop CNIC"
        : step === "enhance"
          ? "Enhance CNIC"
          : "CNIC Ready"
    : step === "capture"
      ? "Scan"
      : step === "crop"
        ? "Crop"
        : step === "enhance"
          ? "Enhance"
          : "Pages";

  return (
    <div className="scan-flow">
      <AppHeader
        title={title}
        backHref={step === "capture" && idSide === "front" ? "/" : undefined}
        action={
          step !== "capture" || (isId && idSide === "back") ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (step === "crop") {
                  setStep("capture");
                  setRawImage(null);
                } else if (step === "enhance") setStep("crop");
                else if (step === "review") {
                  if (isId) {
                    setIdSide("back");
                    setStep("capture");
                  } else setStep("capture");
                } else if (step === "capture" && isId && idSide === "back") {
                  setIdSide("front");
                }
              }}
            >
              Back
            </button>
          ) : null
        }
      />

      {isId && step === "capture" && (
        <div className="id-banner">
          Pakistani CNIC · {idSide === "front" ? "Front" : "Back"} · 85.6 ×
          53.98 mm
          {idSide === "back" && front ? " · Front saved" : ""}
        </div>
      )}

      {!isId && mode !== "document" && step === "capture" && (
        <div className="id-banner">
          {mode === "book" && "Book mode — capture one page at a time"}
          {mode === "slides" && "Slides mode — vivid screen capture"}
          {mode === "whiteboard" && "Whiteboard mode — high-contrast board filter"}
          {mode === "timestamp" && "Timestamp mode — date/time stamped on save"}
        </div>
      )}

      {busy && (
        <div className="busy-bar" aria-live="polite">
          Working…
        </div>
      )}

      {step === "capture" && (
        <>
          {appendToId && !appendReady && (
            <p className="busy-bar">Loading document…</p>
          )}
          <CameraCapture
            onCapture={(src, liveQuad) => void beginWithImage(src, liveQuad)}
            onUpload={(src) => void beginWithImage(src)}
            guide={isId ? "cnic" : "document"}
            guideLabel={
              isId
                ? idSide === "front"
                  ? "CNIC Front · align card in frame"
                  : "CNIC Back · align card in frame"
                : undefined
            }
          />
        </>
      )}

      {step === "crop" && rawImage && quad && (
        <div className="step-panel">
          <p className="hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
            Drag corners to adjust. Use Auto crop or Rotate if needed.
          </p>
          <CropEditor imageSrc={rawImage} quad={quad} onChange={setQuad} />
          <div className="crop-tools" role="toolbar" aria-label="Crop tools">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void runAutoCrop()}
            >
              Auto crop
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void rotateCapture(270)}
            >
              Rotate left
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void rotateCapture(90)}
            >
              Rotate right
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => void useFullPage()}
            >
              Full page
            </button>
          </div>
          <div className="step-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void confirmCrop()}
              disabled={busy}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "enhance" && cropped && (
        <div className="step-panel">
          <FilterPicker
            value={filter}
            previewSrc={cropped}
            previews={previews}
            onChange={setFilter}
          />
          <div className="step-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void addCurrentPage()}
              disabled={busy}
            >
              {isId
                ? idSide === "front"
                  ? "Save front → scan back"
                  : "Save CNIC back"
                : retakePageId
                  ? "Replace page"
                  : "Add page"}
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="step-panel review-panel">
          <div className="page-strip">
            {(isId ? [front, back].filter(Boolean) : pages).map((p, i) =>
              p ? (
                <figure key={p.id} className="page-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageDataUrl}
                    alt={p.side ? `${p.side}` : `Page ${i + 1}`}
                  />
                  <figcaption>
                    {p.side
                      ? p.side === "front"
                        ? "Front"
                        : "Back"
                      : `Page ${i + 1}`}
                  </figcaption>
                </figure>
              ) : null,
            )}
          </div>
          <div className="step-actions stacked">
            {!isId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep("capture")}
              >
                Add another page
              </button>
            )}
            {isId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIdSide(back ? "front" : "back");
                  setStep("capture");
                }}
              >
                Rescan {back ? "a side" : "back"}
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={() => void saveAll()}
              disabled={busy || pages.length === 0 || (isId && !front)}
            >
              {isId ? "Save CNIC" : "Save document"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

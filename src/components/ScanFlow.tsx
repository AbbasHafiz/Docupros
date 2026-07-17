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
import { saveDocument, getDocument } from "@/lib/storage";
import { stampTimestamp } from "@/lib/toolsOps";
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
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!appendToId) return;
    void getDocument(appendToId).then((doc) => {
      if (doc) {
        setExisting(doc);
        setPages(doc.pages);
      }
    });
  }, [appendToId]);

  const beginWithImage = async (dataUrl: string) => {
    setBusy(true);
    setRawImage(dataUrl);
    try {
      const img = await loadImage(dataUrl);
      const detected = await detectDocumentQuad(dataUrl);
      const fallback = isId
        ? defaultIdQuad(img.naturalWidth, img.naturalHeight)
        : defaultQuad(img.naturalWidth, img.naturalHeight);
      setQuad(detected ?? fallback);
      setStep("crop");
    } finally {
      setBusy(false);
    }
  };

  const confirmCrop = async () => {
    if (!rawImage || !quad) return;
    setBusy(true);
    try {
      const warped = await warpPerspective(rawImage, quad);
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
        originalDataUrl: finalImage,
        filter,
        createdAt: Date.now(),
        side: isId ? idSide : undefined,
      };

      setPages((prev) => {
        if (retakePageId) {
          return prev.map((p) =>
            p.id === retakePageId
              ? { ...page, side: p.side ?? page.side }
              : p,
          );
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
    setBusy(true);
    try {
      const now = Date.now();
      const kind = isId || existing?.kind === "id_card" ? "id_card" : "document";
      if (existing) {
        const updated: DocumentRecord = {
          ...existing,
          kind,
          pages,
          updatedAt: now,
          thumbnail: pages[0]?.imageDataUrl,
        };
        await saveDocument(updated);
        startTransition(() => router.push(documentHref(existing.id)));
      } else {
        const id = createId();
        const doc: DocumentRecord = {
          id,
          title: isId
            ? `ID Card ${new Date(now).toLocaleString()}`
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
    } finally {
      setBusy(false);
    }
  };

  const front = pages.find((p) => p.side === "front") ?? pages[0];
  const back = pages.find((p) => p.side === "back");

  const title = isId
    ? step === "capture"
      ? idSide === "front"
        ? "ID Front"
        : "ID Back"
      : step === "crop"
        ? "Crop ID"
        : step === "enhance"
          ? "Enhance ID"
          : "ID Ready"
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
          Scan the <strong>{idSide}</strong> of your ID card
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
        <CameraCapture
          onCapture={(src) => void beginWithImage(src)}
          onUpload={(src) => void beginWithImage(src)}
        />
      )}

      {step === "crop" && rawImage && quad && (
        <div className="step-panel">
          <CropEditor imageSrc={rawImage} quad={quad} onChange={setQuad} />
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
                  : "Save back"
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
              {isId ? "Save ID card" : "Save document"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

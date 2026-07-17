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
  defaultQuad,
  detectDocumentQuad,
  loadImage,
  warpPerspective,
} from "@/lib/imageProcessing";
import { saveDocument, getDocument } from "@/lib/storage";
import type { DocumentRecord, Quad, ScanFilter, ScanPage } from "@/lib/types";

type Props = {
  appendToId?: string;
};

export function ScanFlow({ appendToId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"capture" | "crop" | "enhance" | "review">(
    "capture",
  );
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [cropped, setCropped] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScanFilter>("magic");
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
      setQuad(detected ?? defaultQuad(img.naturalWidth, img.naturalHeight));
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
      const filters: ScanFilter[] = [
        "magic",
        "original",
        "grayscale",
        "bw",
        "soft",
      ];
      const next: Partial<Record<ScanFilter, string>> = { original: warped };
      await Promise.all(
        filters
          .filter((f) => f !== "original")
          .map(async (f) => {
            next[f] = await applyFilter(warped, f);
          }),
      );
      setPreviews(next);
      setFilter("magic");
      setStep("enhance");
    } finally {
      setBusy(false);
    }
  };

  const addCurrentPage = useCallback(async () => {
    if (!cropped) return;
    setBusy(true);
    try {
      const finalImage = await applyFilter(cropped, filter);
      const page: ScanPage = {
        id: createId(),
        imageDataUrl: finalImage,
        originalDataUrl: finalImage,
        filter,
        createdAt: Date.now(),
      };
      setPages((prev) => [...prev, page]);
      setRawImage(null);
      setQuad(null);
      setCropped(null);
      setPreviews({});
      setStep("review");
    } finally {
      setBusy(false);
    }
  }, [cropped, filter]);

  const saveAll = async () => {
    if (pages.length === 0) return;
    setBusy(true);
    try {
      const now = Date.now();
      if (existing) {
        const updated: DocumentRecord = {
          ...existing,
          pages,
          updatedAt: now,
          thumbnail: pages[0]?.imageDataUrl,
        };
        await saveDocument(updated);
        startTransition(() => router.push(`/document/${existing.id}`));
      } else {
        const id = createId();
        const doc: DocumentRecord = {
          id,
          title: `Scan ${new Date(now).toLocaleString()}`,
          pages,
          createdAt: now,
          updatedAt: now,
          thumbnail: pages[0]?.imageDataUrl,
        };
        await saveDocument(doc);
        startTransition(() => router.push(`/document/${id}`));
      }
    } finally {
      setBusy(false);
    }
  };

  const title =
    step === "capture"
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
        backHref={step === "capture" ? "/" : undefined}
        action={
          step !== "capture" ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                if (step === "crop") {
                  setStep("capture");
                  setRawImage(null);
                } else if (step === "enhance") setStep("crop");
                else if (step === "review") setStep("capture");
              }}
            >
              Back
            </button>
          ) : null
        }
      />

      {busy && <div className="busy-bar" aria-live="polite">Working…</div>}

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
              Add page
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="step-panel review-panel">
          <div className="page-strip">
            {pages.map((p, i) => (
              <figure key={p.id} className="page-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageDataUrl} alt={`Page ${i + 1}`} />
                <figcaption>Page {i + 1}</figcaption>
              </figure>
            ))}
          </div>
          <div className="step-actions stacked">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep("capture")}
            >
              Add another page
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void saveAll()}
              disabled={busy || pages.length === 0}
            >
              Save document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

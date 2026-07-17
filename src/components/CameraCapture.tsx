"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Quad } from "@/lib/types";
import {
  detectDocumentQuadFromVideo,
  mapVideoQuadToElement,
} from "@/lib/imageProcessing";

type Props = {
  onCapture: (dataUrl: string, detectedQuad?: Quad) => void;
  onUpload: (dataUrl: string) => void;
  /** Camera guide overlay — Pakistani CNIC frame when "cnic" */
  guide?: "document" | "cnic";
  guideLabel?: string;
};

export function CameraCapture({
  onCapture,
  onUpload,
  guide = "document",
  guideLabel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const lastQuadRef = useRef<Quad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [detected, setDetected] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setError(
          "Camera unavailable. Upload a photo of your document instead.",
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Live edge detection loop (document mode)
  useEffect(() => {
    if (!ready || error || guide === "cnic") return;

    let raf = 0;
    let cancelled = false;
    let lastRun = 0;
    const intervalMs = 120;
    const workCanvas = document.createElement("canvas");
    const smoothRef = {
      tl: { x: 0, y: 0 },
      tr: { x: 0, y: 0 },
      br: { x: 0, y: 0 },
      bl: { x: 0, y: 0 },
      primed: false,
    };

    const drawOverlay = (quad: Quad | null, strong: boolean) => {
      const canvas = overlayRef.current;
      const frame = frameRef.current;
      if (!canvas || !frame) return;
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      if (!quad) return;

      ctx.beginPath();
      ctx.moveTo(quad.tl.x, quad.tl.y);
      ctx.lineTo(quad.tr.x, quad.tr.y);
      ctx.lineTo(quad.br.x, quad.br.y);
      ctx.lineTo(quad.bl.x, quad.bl.y);
      ctx.closePath();
      ctx.fillStyle = strong
        ? "rgba(45, 212, 191, 0.14)"
        : "rgba(45, 212, 191, 0.06)";
      ctx.fill();
      ctx.strokeStyle = strong
        ? "rgba(52, 211, 153, 0.95)"
        : "rgba(45, 212, 191, 0.55)";
      ctx.lineWidth = strong ? 3 : 2;
      ctx.lineJoin = "round";
      ctx.stroke();

      const corners = [quad.tl, quad.tr, quad.br, quad.bl];
      for (const c of corners) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, strong ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = strong ? "#34d399" : "#2dd4bf";
        ctx.fill();
        ctx.strokeStyle = "rgba(7, 18, 24, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    const tick = (now: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(tick);
      if (now - lastRun < intervalMs) return;
      lastRun = now;

      const video = videoRef.current;
      const frame = frameRef.current;
      if (!video || !frame || video.readyState < 2) return;

      const result = detectDocumentQuadFromVideo(video, 260, workCanvas);
      if (result.found && result.confidence >= 0.4) {
        const mapped = mapVideoQuadToElement(result.quad, video, frame);
        const alpha = smoothRef.primed ? 0.35 : 1;
        const blend = (from: { x: number; y: number }, to: { x: number; y: number }) => ({
          x: from.x + (to.x - from.x) * alpha,
          y: from.y + (to.y - from.y) * alpha,
        });
        const smoothed: Quad = {
          tl: blend(smoothRef.tl, mapped.tl),
          tr: blend(smoothRef.tr, mapped.tr),
          br: blend(smoothRef.br, mapped.br),
          bl: blend(smoothRef.bl, mapped.bl),
        };
        smoothRef.tl = smoothed.tl;
        smoothRef.tr = smoothed.tr;
        smoothRef.br = smoothed.br;
        smoothRef.bl = smoothed.bl;
        smoothRef.primed = true;
        lastQuadRef.current = result.quad;
        setDetected(true);
        drawOverlay(smoothed, result.confidence >= 0.55);
      } else {
        lastQuadRef.current = null;
        smoothRef.primed = false;
        setDetected(false);
        drawOverlay(null, false);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const canvas = overlayRef.current;
      const ctx = canvas?.getContext("2d");
      ctx?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
      lastQuadRef.current = null;
      setDetected(false);
    };
  }, [ready, error, guide]);

  const snap = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    onCapture(
      canvas.toDataURL("image/jpeg", 0.92),
      guide === "document" ? (lastQuadRef.current ?? undefined) : undefined,
    );
  }, [onCapture, ready, guide]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onUpload(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const openGallery = () => {
    const input = galleryRef.current;
    if (!input) return;
    // Allow selecting the same file again
    input.value = "";
    input.click();
  };

  return (
    <div className="capture-stage">
      <div className="capture-frame" ref={frameRef}>
        {!error ? (
          <video
            ref={videoRef}
            className="capture-video"
            playsInline
            muted
            autoPlay
          />
        ) : (
          <div className="capture-fallback">
            <p>{error}</p>
          </div>
        )}
        {guide === "document" && (
          <canvas
            ref={overlayRef}
            className="edge-overlay"
            aria-hidden
          />
        )}
        <div
          className={`viewfinder ${guide === "cnic" ? "cnic" : ""} ${
            guide === "document" && detected ? "is-detected" : ""
          } ${guide === "document" ? "is-live" : ""}`}
          aria-hidden
        >
          {guide === "cnic" && (
            <span className="viewfinder-label">
              {guideLabel || "CNIC 85.6 × 53.98 mm"}
            </span>
          )}
          {guide === "document" && (
            <span className="viewfinder-label">
              {detected ? "Edges detected — tap capture" : "Point at a document"}
            </span>
          )}
        </div>
      </div>

      <div className="capture-actions">
        <button type="button" className="btn-ghost" onClick={openGallery}>
          Gallery
        </button>
        <button
          type="button"
          className={`shutter ${detected ? "is-locked" : ""}`}
          onClick={snap}
          disabled={!ready}
          aria-label="Capture document"
        />
        <button type="button" className="btn-ghost" onClick={openGallery}>
          Upload
        </button>
      </div>

      {/* No capture= attribute — that forces the camera on mobile */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
